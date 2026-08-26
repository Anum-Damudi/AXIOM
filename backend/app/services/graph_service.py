import logging
import networkx as nx
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.neo4j import neo4j_client
from app.models import Person, Vehicle, Location, Case, Relationship
from app.schemas.graph import CytoscapeGraphData, GraphNode, GraphEdge

logger = logging.getLogger("axiom.graph")

class GraphService:
    @staticmethod
    def get_full_graph(db: Session) -> CytoscapeGraphData:
        # Try Neo4j first
        neo4j_client.connect()
        if neo4j_client._is_connected:
            try:
                nodes_res = neo4j_client.execute_query("MATCH (n) RETURN n, labels(n) as labels")
                edges_res = neo4j_client.execute_query("MATCH (s)-[r]->(t) RETURN s.id as source, t.id as target, type(r) as relationship, properties(r) as props")
                
                nodes = []
                edges = []
                seen_nodes = set()

                for record in nodes_res:
                    n = record.get("n", {})
                    labels = record.get("labels", [])
                    label = labels[0] if labels else "Entity"
                    node_id = n.get("id")
                    if node_id and node_id not in seen_nodes:
                        seen_nodes.add(node_id)
                        name = n.get("name") or n.get("title") or n.get("plate_number") or node_id
                        nodes.append(GraphNode(
                            id=node_id,
                            label=label,
                            name=name,
                            type=label.lower(),
                            metadata=n
                        ))

                for idx, record in enumerate(edges_res, start=1):
                    src = record.get("source")
                    tgt = record.get("target")
                    rel = record.get("relationship")
                    props = record.get("props", {})
                    rel_id = props.get("id") or f"REL_{idx}"
                    if src and tgt:
                        edges.append(GraphEdge(
                            id=rel_id,
                            source=src,
                            target=tgt,
                            relationship=rel,
                            metadata=props
                        ))

                return CytoscapeGraphData(nodes=nodes, edges=edges)
            except Exception as e:
                logger.error(f"Error reading from Neo4j: {e}. Falling back to PostgreSQL NetworkX graph generation.")

        # Fallback: Generate graph directly from PostgreSQL system of record
        return GraphService._build_graph_from_postgres(db)

    @staticmethod
    def get_case_subgraph(db: Session, case_id: str) -> CytoscapeGraphData:
        # Build subgraph around a case
        relationships = db.query(Relationship).filter(
            (Relationship.case_id == case_id) | (Relationship.target == case_id) | (Relationship.source == case_id)
        ).all()

        node_ids = set([case_id])
        for r in relationships:
            node_ids.add(r.source)
            node_ids.add(r.target)

        return GraphService._build_subgraph_for_nodes(db, node_ids, relationships)

    @staticmethod
    def _build_graph_from_postgres(db: Session) -> CytoscapeGraphData:
        all_relationships = db.query(Relationship).all()
        all_people = db.query(Person).all()
        all_vehicles = db.query(Vehicle).all()
        all_locations = db.query(Location).all()
        all_cases = db.query(Case).all()

        nodes = []
        for p in all_people:
            nodes.append(GraphNode(id=p.id, label="Person", name=p.name, type="person", metadata={"role": p.role, "age": p.age}))
        for v in all_vehicles:
            nodes.append(GraphNode(id=v.id, label="Vehicle", name=v.plate_number, type="vehicle", metadata={"type": v.type}))
        for l in all_locations:
            nodes.append(GraphNode(id=l.id, label="Location", name=l.name, type="location", metadata={"lat": l.lat, "lng": l.lng}))
        for c in all_cases:
            nodes.append(GraphNode(id=c.id, label="Case", name=c.title, type="case", metadata={"status": c.status, "date": c.date}))

        edges = []
        for r in all_relationships:
            edges.append(GraphEdge(
                id=r.id,
                source=r.source,
                target=r.target,
                relationship=r.type,
                metadata={"date": r.date, "confidence": r.confidence, "provenance": r.provenance}
            ))

        return CytoscapeGraphData(nodes=nodes, edges=edges)

    @staticmethod
    def _build_subgraph_for_nodes(db: Session, node_ids: set, relationships: List[Relationship]) -> CytoscapeGraphData:
        nodes = []
        for nid in node_ids:
            if nid.startswith("P"):
                p = db.query(Person).filter(Person.id == nid).first()
                if p:
                    nodes.append(GraphNode(id=p.id, label="Person", name=p.name, type="person", metadata={"role": p.role}))
            elif nid.startswith("V"):
                v = db.query(Vehicle).filter(Vehicle.id == nid).first()
                if v:
                    nodes.append(GraphNode(id=v.id, label="Vehicle", name=v.plate_number, type="vehicle", metadata={"type": v.type}))
            elif nid.startswith("L"):
                l = db.query(Location).filter(Location.id == nid).first()
                if l:
                    nodes.append(GraphNode(id=l.id, label="Location", name=l.name, type="location", metadata={"lat": l.lat, "lng": l.lng}))
            elif nid.startswith("C"):
                c = db.query(Case).filter(Case.id == nid).first()
                if c:
                    nodes.append(GraphNode(id=c.id, label="Case", name=c.title, type="case", metadata={"status": c.status}))

        edges = []
        for r in relationships:
            edges.append(GraphEdge(
                id=r.id,
                source=r.source,
                target=r.target,
                relationship=r.type,
                metadata={"date": r.date, "confidence": r.confidence}
            ))

        return CytoscapeGraphData(nodes=nodes, edges=edges)

    @staticmethod
    def sync_relationship_to_graph(rel_id: str, source: str, target: str, rel_type: str, metadata: dict = None):
        neo4j_client.connect()
        if not neo4j_client._is_connected:
            return
        query = f"""
        MERGE (s {{id: $source}})
        MERGE (t {{id: $target}})
        MERGE (s)-[r:{rel_type.upper().replace(' ', '_')}]->(t)
        SET r.id = $rel_id, r.date = $date
        """
        params = {
            "source": source,
            "target": target,
            "rel_id": rel_id,
            "date": (metadata or {}).get("date")
        }
        neo4j_client.execute_query(query, params)
