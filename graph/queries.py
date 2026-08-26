"""Read-side Cypher helpers: search, neighbors, paths, case subgraphs."""

from __future__ import annotations

from typing import Any

from graph.connection import run_query
from graph.ethics import INVESTIGATIVE_DISCLAIMER
from graph.models import NODE_LABELS


def search_entities(q: str, limit: int = 20, label: str | None = None) -> list[dict[str, Any]]:
    text = q.strip()
    if label:
        if label not in NODE_LABELS:
            raise ValueError(f"Unknown label {label}")
        cypher = (
            f"MATCH (n:{label}) "
            "WHERE toLower(n.id) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.name, '')) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.title, '')) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.plate_number, '')) CONTAINS toLower($q) "
            "RETURN n {.*, labels: labels(n)} AS node "
            "LIMIT $limit"
        )
    else:
        cypher = (
            "MATCH (n) "
            "WHERE toLower(n.id) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.name, '')) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.title, '')) CONTAINS toLower($q) "
            "   OR toLower(coalesce(n.plate_number, '')) CONTAINS toLower($q) "
            "RETURN n {.*, labels: labels(n)} AS node "
            "LIMIT $limit"
        )
    return [row["node"] for row in run_query(cypher, q=text, limit=limit)]


def get_entity(node_id: str) -> dict[str, Any] | None:
    rows = run_query(
        "MATCH (n {id: $id}) RETURN n {.*, labels: labels(n)} AS node",
        id=node_id,
    )
    return rows[0]["node"] if rows else None


def neighbors(node_id: str, depth: int = 1, limit: int = 100) -> dict[str, Any]:
    return case_style_subgraph(node_id, depth=depth, limit=limit)


def case_style_subgraph(node_id: str, depth: int = 2, limit: int = 200) -> dict[str, Any]:
    """Undirected subgraph around any node, JSON-ready for the frontend."""
    depth = max(1, min(depth, 4))
    cypher = (
        f"MATCH (anchor {{id: $id}}) "
        f"MATCH path = (anchor)-[*0..{depth}]-(n) "
        "WITH collect(DISTINCT n)[0..$limit] AS nodes, collect(path) AS paths "
        "UNWIND paths AS p "
        "UNWIND relationships(p) AS rel "
        "WITH nodes, collect(DISTINCT { "
        "  source: startNode(rel).id, "
        "  target: endNode(rel).id, "
        "  type: type(rel), "
        "  properties: rel {.date, .confidence, .source_module, .case_id, .interpretation} "
        "}) AS edges "
        "RETURN [x IN nodes | x {.*, labels: labels(x)}] AS nodes, edges"
    )
    rows = run_query(cypher, id=node_id, limit=limit)
    if not rows:
        return {"center_id": node_id, "nodes": [], "edges": []}
    return {
        "center_id": node_id,
        "nodes": rows[0]["nodes"] or [],
        "edges": [e for e in (rows[0]["edges"] or []) if e.get("source")],
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def case_subgraph(case_id: str, depth: int = 2) -> dict[str, Any]:
    data = case_style_subgraph(case_id, depth=depth)
    data["case_id"] = case_id
    return data


def shortest_path(source_id: str, target_id: str, max_hops: int = 6) -> dict[str, Any]:
    max_hops = max(1, min(max_hops, 8))
    cypher = (
        f"MATCH (a {{id: $source_id}}), (b {{id: $target_id}}) "
        f"MATCH path = shortestPath((a)-[*..{max_hops}]-(b)) "
        "RETURN [n IN nodes(path) | n {.*, labels: labels(n)}] AS nodes, "
        "[r IN relationships(path) | { "
        "  source: startNode(r).id, target: endNode(r).id, type: type(r), "
        "  properties: r {.*} "
        "}] AS edges, length(path) AS hops"
    )
    rows = run_query(cypher, source_id=source_id, target_id=target_id)
    if not rows:
        return {
            "found": False,
            "source_id": source_id,
            "target_id": target_id,
            "nodes": [],
            "edges": [],
            "hops": None,
            "interpretation": "inferred_potential_connection",
            "disclaimer": INVESTIGATIVE_DISCLAIMER,
        }
    row = rows[0]
    return {
        "found": True,
        "source_id": source_id,
        "target_id": target_id,
        "nodes": row["nodes"],
        "edges": row["edges"],
        "hops": row["hops"],
        "path_ids": [n["id"] for n in row["nodes"]],
        "explanation": _explain_path(row["nodes"], row["edges"]),
        "interpretation": "inferred_potential_connection",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def multi_hop_paths(source_id: str, target_id: str, max_hops: int = 4, limit: int = 5) -> dict[str, Any]:
    max_hops = max(1, min(max_hops, 6))
    cypher = (
        f"MATCH (a {{id: $source_id}}), (b {{id: $target_id}}) "
        f"MATCH path = allShortestPaths((a)-[*..{max_hops}]-(b)) "
        "WITH path LIMIT $limit "
        "RETURN [n IN nodes(path) | n.id] AS path_ids, "
        "[n IN nodes(path) | n {.*, labels: labels(n)}] AS nodes, "
        "[r IN relationships(path) | { "
        "  source: startNode(r).id, target: endNode(r).id, type: type(r), "
        "  properties: r {.date, .confidence, .source_module, .interpretation} "
        "}] AS edges, length(path) AS hops"
    )
    rows = run_query(cypher, source_id=source_id, target_id=target_id, limit=limit)
    paths = []
    for row in rows:
        paths.append(
            {
                "path_ids": row["path_ids"],
                "nodes": row["nodes"],
                "edges": row["edges"],
                "hops": row["hops"],
                "explanation": _explain_path(row["nodes"], row["edges"]),
            }
        )
    return {
        "source_id": source_id,
        "target_id": target_id,
        "path_count": len(paths),
        "paths": paths,
        "interpretation": "inferred_potential_connection",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def _explain_path(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> str:
    names = []
    for n in nodes:
        label = (n.get("labels") or ["Entity"])[0]
        title = n.get("name") or n.get("title") or n.get("plate_number") or n.get("id")
        names.append(f"{title} ({label} {n.get('id')})")
    rels = " → ".join(e.get("type", "?") for e in edges)
    return "Potential connection path: " + " — ".join(names) + f". Relationship sequence: {rels}."


def cross_case_entities(case_id: str) -> dict[str, Any]:
    """Entities in this case that also appear on other cases (fact-level overlap)."""
    cypher = (
        "MATCH (c:Case {id: $case_id})<-[:INVOLVED_IN]-(n) "
        "MATCH (n)-[:INVOLVED_IN]->(other:Case) "
        "WHERE other.id <> c.id "
        "RETURN labels(n)[0] AS node_type, n.id AS entity_id, "
        "coalesce(n.name, n.title, n.plate_number, n.id) AS display, "
        "collect(DISTINCT other.id) AS other_case_ids"
    )
    rows = run_query(cypher, case_id=case_id)
    return {
        "case_id": case_id,
        "shared_entities": rows,
        "interpretation": "extracted_fact",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }
