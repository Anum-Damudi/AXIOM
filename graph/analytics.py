"""Centrality and community detection.

Primary path: pull an undirected projection into NetworkX so the demo works
even when the Neo4j GDS plugin is not installed. Optional GDS Cypher is
attempted and ignored if the plugin is missing.
"""

from __future__ import annotations

from typing import Any

import networkx as nx
from networkx.algorithms import community as nx_community

from graph.connection import run_query
from graph.ethics import INVESTIGATIVE_DISCLAIMER

ANALYTICS_NOTE = (
    "Centrality and communities describe graph structure, not importance as a "
    "suspect. High scores mean an entity sits on many paths or in a dense group "
    "of recorded relationships. Treat every score as an investigative lead."
)


def _pagerank(graph: nx.Graph, alpha: float = 0.85) -> dict[str, float]:
    """Compute PageRank without requiring the optional SciPy dependency."""
    nodes = list(graph)
    if not nodes:
        return {}
    rank = {node: 1.0 / len(nodes) for node in nodes}
    for _ in range(100):
        next_rank = {node: (1.0 - alpha) / len(nodes) for node in nodes}
        dangling = sum(rank[node] for node in nodes if graph.degree(node) == 0)
        for node in nodes:
            share = rank[node] / graph.degree(node) if graph.degree(node) else 0.0
            for neighbor in graph[node]:
                next_rank[neighbor] += alpha * share
        dangling_share = alpha * dangling / len(nodes)
        next_rank = {node: score + dangling_share for node, score in next_rank.items()}
        if max(abs(next_rank[node] - rank[node]) for node in nodes) < 1e-8:
            return next_rank
        rank = next_rank
    return rank


def _load_undirected_graph(case_id: str | None = None) -> nx.Graph:
    if case_id:
        cypher = (
            "MATCH (c:Case {id: $case_id}) "
            "MATCH (c)-[*1..3]-(n) "
            "WITH collect(DISTINCT n) AS related, c "
            "WITH related + [c] AS nodes "
            "UNWIND nodes AS a "
            "UNWIND nodes AS b "
            "MATCH (a)-[r]-(b) "
            "WHERE elementId(a) < elementId(b) "
            "RETURN a.id AS source, b.id AS target, type(r) AS type, "
            "labels(a)[0] AS source_label, labels(b)[0] AS target_label, "
            "coalesce(a.name, a.title, a.plate_number, a.id) AS source_name, "
            "coalesce(b.name, b.title, b.plate_number, b.id) AS target_name"
        )
        rows = run_query(cypher, case_id=case_id)
    else:
        cypher = (
            "MATCH (a)-[r]-(b) "
            "WHERE elementId(a) < elementId(b) "
            "RETURN a.id AS source, b.id AS target, type(r) AS type, "
            "labels(a)[0] AS source_label, labels(b)[0] AS target_label, "
            "coalesce(a.name, a.title, a.plate_number, a.id) AS source_name, "
            "coalesce(b.name, b.title, b.plate_number, b.id) AS target_name"
        )
        rows = run_query(cypher)

    graph = nx.Graph()
    for row in rows:
        graph.add_node(
            row["source"],
            label=row["source_label"],
            display=row["source_name"],
        )
        graph.add_node(
            row["target"],
            label=row["target_label"],
            display=row["target_name"],
        )
        graph.add_edge(row["source"], row["target"], type=row["type"])
    return graph


def _rank_map(scores: dict[str, float], graph: nx.Graph, top_n: int) -> list[dict[str, Any]]:
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    payload = []
    for node_id, score in ranked:
        data = graph.nodes[node_id]
        payload.append(
            {
                "id": node_id,
                "display": data.get("display", node_id),
                "node_type": data.get("label", "Entity"),
                "score": round(float(score), 6),
                "meaning": "structural_prominence",
            }
        )
    return payload


def centrality(case_id: str | None = None, top_n: int = 15) -> dict[str, Any]:
    graph = _load_undirected_graph(case_id)
    if graph.number_of_nodes() == 0:
        return {"algorithms": {}, "nodes": [], "disclaimer": INVESTIGATIVE_DISCLAIMER}

    degree = nx.degree_centrality(graph)
    pagerank = _pagerank(graph)
    betweenness = nx.betweenness_centrality(graph)

    return {
        "case_id": case_id,
        "node_count": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
        "algorithms": {
            "degree_centrality": {
                "what": "Fraction of recorded neighbors an entity has.",
                "why": "Surfaces people, vehicles, or places that appear in many relationships — useful as a starting point, not as a guilt signal.",
                "top": _rank_map(degree, graph, top_n),
            },
            "pagerank": {
                "what": "Importance based on being connected to other well-connected entities.",
                "why": "Highlights hubs that sit in dense recorded networks (for example a repeatedly used vehicle or location).",
                "top": _rank_map(pagerank, graph, top_n),
            },
            "betweenness_centrality": {
                "what": "How often an entity lies on shortest paths between others.",
                "why": "Can flag bridge entities that connect otherwise separate clusters — a common investigative lead for cross-case linking.",
                "top": _rank_map(betweenness, graph, top_n),
            },
        },
        "visualization_hint": (
            "Member 5: size nodes by pagerank, color by community, and keep a "
            "tooltip that says 'structural score — not a finding of involvement'."
        ),
        "interpretation": "inferred_potential_connection",
        "note": ANALYTICS_NOTE,
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def communities(case_id: str | None = None) -> dict[str, Any]:
    graph = _load_undirected_graph(case_id)
    if graph.number_of_nodes() == 0:
        return {"communities": [], "disclaimer": INVESTIGATIVE_DISCLAIMER}

    groups = list(nx_community.louvain_communities(graph, seed=42))
    components = [set(c) for c in nx.connected_components(graph)]

    community_payload = []
    node_community: dict[str, int] = {}
    for idx, group in enumerate(sorted(groups, key=len, reverse=True)):
        members = []
        for node_id in sorted(group):
            node_community[node_id] = idx
            data = graph.nodes[node_id]
            members.append(
                {
                    "id": node_id,
                    "display": data.get("display", node_id),
                    "node_type": data.get("label", "Entity"),
                }
            )
        community_payload.append(
            {
                "community_id": idx,
                "size": len(members),
                "members": members,
                "meaning": "cluster_of_recorded_relationships",
            }
        )

    return {
        "case_id": case_id,
        "algorithm": "louvain",
        "what": "Groups entities that are densely connected to each other and sparsely connected to the rest of the graph.",
        "why": "Helps investigators see possible groups, locations, or case clusters. Membership is not evidence of a criminal organization.",
        "communities": community_payload,
        "connected_component_count": len(components),
        "node_community": node_community,
        "visualization_hint": "Color nodes by community_id. Do not label a community as a gang or syndicate.",
        "interpretation": "inferred_potential_connection",
        "note": ANALYTICS_NOTE,
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def node_scores_for_frontend(case_id: str | None = None) -> dict[str, dict[str, Any]]:
    """Per-node overlay Member 5 can merge into graph JSON."""
    graph = _load_undirected_graph(case_id)
    if graph.number_of_nodes() == 0:
        return {}
    degree = nx.degree_centrality(graph)
    pagerank = _pagerank(graph)
    groups = list(nx_community.louvain_communities(graph, seed=42))
    comm = {}
    for idx, group in enumerate(groups):
        for node_id in group:
            comm[node_id] = idx
    overlay = {}
    for node_id in graph.nodes:
        overlay[node_id] = {
            "degree_centrality": round(degree.get(node_id, 0.0), 6),
            "pagerank": round(pagerank.get(node_id, 0.0), 6),
            "community_id": comm.get(node_id),
        }
    return overlay
