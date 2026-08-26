"""Frontend-facing graph JSON (Member 5)."""

from __future__ import annotations

from typing import Any

from graph.analytics import node_scores_for_frontend
from graph.ethics import INVESTIGATIVE_DISCLAIMER
from graph.queries import case_subgraph, get_entity, shortest_path
from graph.temporal import event_timeline


def _display(node: dict[str, Any]) -> str:
    return node.get("name") or node.get("title") or node.get("plate_number") or node.get("id")


def _node_type(node: dict[str, Any]) -> str:
    labels = node.get("labels") or []
    return labels[0] if labels else "Entity"


def serialize_graph(
    *,
    case_id: str | None = None,
    center_id: str | None = None,
    highlight_path: list[str] | None = None,
    include_analytics: bool = True,
    depth: int = 2,
) -> dict[str, Any]:
    target = case_id or center_id
    if not target:
        raise ValueError("case_id or center_id is required")
    raw = case_subgraph(target, depth=depth)
    overlay = node_scores_for_frontend(case_id) if include_analytics else {}
    highlighted = set(highlight_path or [])

    nodes = []
    for node in raw.get("nodes") or []:
        nid = node.get("id")
        extra = overlay.get(nid, {})
        nodes.append(
            {
                "id": nid,
                "label": _display(node),
                "type": _node_type(node),
                "properties": {
                    k: v
                    for k, v in node.items()
                    if k not in {"labels"} and not hasattr(v, "iso_format")
                },
                "degree_centrality": extra.get("degree_centrality"),
                "pagerank": extra.get("pagerank"),
                "community_id": extra.get("community_id"),
                "highlighted": nid in highlighted,
            }
        )

    edges = []
    for edge in raw.get("edges") or []:
        props = edge.get("properties") or {}
        src, tgt = edge.get("source"), edge.get("target")
        edges.append(
            {
                "id": f"{src}-{edge.get('type')}-{tgt}",
                "source": src,
                "target": tgt,
                "type": edge.get("type"),
                "label": edge.get("type"),
                "confidence": props.get("confidence"),
                "timestamp": props.get("date"),
                "interpretation": props.get("interpretation", "extracted_fact"),
                "highlighted": src in highlighted and tgt in highlighted,
            }
        )

    case_info = get_entity(case_id) if case_id else None
    timeline = event_timeline(case_ids=[case_id] if case_id else None, entity_id=None if case_id else center_id)

    return {
        "case": case_info,
        "nodes": nodes,
        "edges": edges,
        "highlighted_path": highlight_path or [],
        "timeline": timeline.get("items", []),
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def serialize_path(source_id: str, target_id: str) -> dict[str, Any]:
    path = shortest_path(source_id, target_id)
    return {
        **path,
        "frontend": {
            "highlight_node_ids": path.get("path_ids", []),
            "highlight_edge_types": [e.get("type") for e in path.get("edges", [])],
        },
    }
