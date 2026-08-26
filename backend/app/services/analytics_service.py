import logging
import networkx as nx
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Person, Vehicle, Location, Relationship
from app.schemas.analytics import NetworkMetricResult, CommunityClusterResult, HiddenLinkResult

logger = logging.getLogger("axiom.analytics")

class AnalyticsService:
    @staticmethod
    def get_key_persons(db: Session, limit: int = 10) -> List[NetworkMetricResult]:
        G = AnalyticsService._build_networkx_graph(db)
        if len(G) == 0:
            return []

        # Degree centrality and Betweenness centrality
        deg_centrality = nx.degree_centrality(G)
        bet_centrality = nx.betweenness_centrality(G)

        results: List[NetworkMetricResult] = []
        for node_id, deg_score in sorted(deg_centrality.items(), key=lambda x: x[1], reverse=True):
            if not node_id.startswith("P"):
                continue

            person = db.query(Person).filter(Person.id == node_id).first()
            if not person:
                continue

            bet_score = bet_centrality.get(node_id, 0.0)
            combo_score = round((deg_score * 0.5 + bet_score * 0.5), 4)

            # Degree neighbor count
            neighbors = list(G.neighbors(node_id))

            results.append(NetworkMetricResult(
                entity_id=person.id,
                entity_name=person.name,
                entity_type="person",
                metric="betweenness_and_degree_centrality",
                score=combo_score,
                interpretation=f"High network connectivity ({len(neighbors)} direct links). Bridge node across investigation entities.",
                evidence=[f"Directly connected to {len(neighbors)} distinct entities in knowledge graph."]
            ))
            if len(results) >= limit:
                break

        return results

    @staticmethod
    def get_communities(db: Session) -> List[CommunityClusterResult]:
        G = AnalyticsService._build_networkx_graph(db).to_undirected()
        if len(G) == 0:
            return []

        # Connected components as community clusters
        components = list(nx.connected_components(G))
        clusters: List[CommunityClusterResult] = []

        for idx, comp in enumerate(components, start=1):
            members = []
            for nid in comp:
                if nid.startswith("P"):
                    p = db.query(Person).filter(Person.id == nid).first()
                    if p:
                        members.append({"id": p.id, "name": p.name, "type": "person", "role": p.role})
                elif nid.startswith("V"):
                    v = db.query(Vehicle).filter(Vehicle.id == nid).first()
                    if v:
                        members.append({"id": v.id, "name": v.plate_number, "type": "vehicle"})
                elif nid.startswith("L"):
                    l = db.query(Location).filter(Location.id == nid).first()
                    if l:
                        members.append({"id": l.id, "name": l.name, "type": "location"})

            if len(members) >= 2:
                clusters.append(CommunityClusterResult(
                    community_id=idx,
                    size=len(members),
                    members=members,
                    description=f"Connected network group containing {len(members)} cross-linked entities."
                ))

        return sorted(clusters, key=lambda x: x.size, reverse=True)

    @staticmethod
    def get_hidden_links(db: Session, limit: int = 5) -> List[HiddenLinkResult]:
        G = AnalyticsService._build_networkx_graph(db).to_undirected()
        people = db.query(Person).all()
        hidden_links: List[HiddenLinkResult] = []

        people_ids = [p.id for p in people]
        for i in range(len(people_ids)):
            for j in range(i + 1, len(people_ids)):
                p1_id = people_ids[i]
                p2_id = people_ids[j]

                # If no direct edge exists, but shortest path exists
                if not G.has_edge(p1_id, p2_id) and nx.has_path(G, p1_id, p2_id):
                    path = nx.shortest_path(G, p1_id, p2_id)
                    if 2 < len(path) <= 4:  # Indirect path via 1 or 2 intermediate entities
                        p1 = db.query(Person).filter(Person.id == p1_id).first()
                        p2 = db.query(Person).filter(Person.id == p2_id).first()
                        
                        intermediates = []
                        for node_id in path[1:-1]:
                            if node_id.startswith("P"):
                                p = db.query(Person).filter(Person.id == node_id).first()
                                intermediates.append({"id": node_id, "name": p.name if p else node_id, "type": "person"})
                            elif node_id.startswith("V"):
                                v = db.query(Vehicle).filter(Vehicle.id == node_id).first()
                                intermediates.append({"id": node_id, "name": v.plate_number if v else node_id, "type": "vehicle"})
                            elif node_id.startswith("L"):
                                l = db.query(Location).filter(Location.id == node_id).first()
                                intermediates.append({"id": node_id, "name": l.name if l else node_id, "type": "location"})
                            else:
                                intermediates.append({"id": node_id, "name": node_id, "type": "entity"})

                        hidden_links.append(HiddenLinkResult(
                            source_entity={"id": p1.id, "name": p1.name, "type": "person"},
                            target_entity={"id": p2.id, "name": p2.name, "type": "person"},
                            path_length=len(path) - 1,
                            intermediate_nodes=intermediates,
                            confidence=0.88,
                            explanation=f"Indirect connection detected: {p1.name} and {p2.name} share indirect link via {', '.join([x['name'] for x in intermediates])}."
                        ))
                        if len(hidden_links) >= limit:
                            return hidden_links

        return hidden_links

    @staticmethod
    def _build_networkx_graph(db: Session) -> nx.Graph:
        G = nx.Graph()
        relationships = db.query(Relationship).all()
        for r in relationships:
            G.add_edge(r.source, r.target, type=r.type, id=r.id)
        return G
