"""MERGE-based node upserts. Stable IDs are the only identity key."""

from __future__ import annotations

from typing import Any

from graph.connection import run_write
from graph.models import NODE_LABELS

REQUIRED_BY_LABEL = {
    "Person": ["id", "name"],
    "Case": ["id", "title"],
    "Vehicle": ["id"],
    "Location": ["id", "name"],
    "Organization": ["id", "name"],
    "Event": ["id", "event_type"],
    "Evidence": ["id"],
    "Image": ["id"],
    "Report": ["id"],
}


def infer_label(entity_id: str, explicit: str | None = None) -> str:
    if explicit:
        label = explicit[0].upper() + explicit[1:]
        if label in NODE_LABELS:
            return label
        raise ValueError(f"Unknown node label: {explicit}")
    if entity_id.startswith("RPT"):
        return "Report"
    if entity_id.startswith("IMG"):
        return "Image"
    if entity_id.startswith("EV"):
        return "Evidence"
    prefix = entity_id[0]
    mapping = {
        "P": "Person",
        "C": "Case",
        "V": "Vehicle",
        "L": "Location",
        "O": "Organization",
        "E": "Event",
    }
    if prefix not in mapping:
        raise ValueError(f"Cannot infer label from id {entity_id}")
    return mapping[prefix]


def upsert_node(label: str, properties: dict[str, Any]) -> dict[str, Any]:
    if label not in NODE_LABELS:
        raise ValueError(f"Unknown node label: {label}")
    node_id = properties.get("id")
    if not node_id:
        raise ValueError(f"{label} requires a stable id (e.g. P001), not a name")
    for field in REQUIRED_BY_LABEL[label]:
        if not properties.get(field):
            raise ValueError(f"{label} missing required field '{field}'")

    props = {k: v for k, v in properties.items() if v is not None}
    cypher = (
        f"MERGE (n:{label} {{id: $id}}) "
        "ON CREATE SET n += $props, n.created_at = datetime(), n.updated_at = datetime() "
        "ON MATCH SET n += $props, n.updated_at = datetime() "
        "RETURN n {{.*, labels: labels(n)}} AS node"
    )
    rows = run_write(cypher, id=node_id, props=props)
    return rows[0]["node"]


def ensure_node(label: str, node_id: str, defaults: dict[str, Any] | None = None) -> None:
    """Create the node if missing; never overwrite existing properties."""
    if label not in NODE_LABELS:
        raise ValueError(f"Unknown node label: {label}")
    props = {"id": node_id, **(defaults or {})}
    cypher = (
        f"MERGE (n:{label} {{id: $id}}) "
        "ON CREATE SET n += $props, n.created_at = datetime(), n.updated_at = datetime()"
    )
    run_write(cypher, id=node_id, props=props)


def get_node(node_id: str, label: str | None = None) -> dict[str, Any] | None:
    if label:
        cypher = f"MATCH (n:{label} {{id: $id}}) RETURN n {{.*, labels: labels(n)}} AS node"
    else:
        cypher = "MATCH (n {id: $id}) RETURN n {.*, labels: labels(n)} AS node"
    from graph.connection import run_query

    rows = run_query(cypher, id=node_id)
    return rows[0]["node"] if rows else None


def upsert_nodes(label: str, items: list[dict[str, Any]]) -> int:
    count = 0
    for item in items:
        upsert_node(label, item)
        count += 1
    return count
