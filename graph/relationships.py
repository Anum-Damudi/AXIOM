"""MERGE-based relationship upserts with a deterministic rel_key."""

from __future__ import annotations

from typing import Any

from graph.connection import run_write
from graph.models import RELATIONSHIP_TYPES
from graph.nodes import infer_label


def rel_key(source_id: str, rel_type: str, target_id: str, date: str | None = None) -> str:
    day = date or ""
    return f"{source_id}|{rel_type}|{target_id}|{day}"


def upsert_relationship(
    source_id: str,
    rel_type: str,
    target_id: str,
    *,
    source_label: str | None = None,
    target_label: str | None = None,
    date: str | None = None,
    confidence: float | None = None,
    source: str = "seed",
    case_id: str | None = None,
    evidence_id: str | None = None,
    interpretation: str = "extracted_fact",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if rel_type not in RELATIONSHIP_TYPES:
        raise ValueError(
            f"Relationship '{rel_type}' is not a stored fact type. "
            "Use the hidden-link API for inferred potential connections."
        )
    src_label = infer_label(source_id, source_label)
    tgt_label = infer_label(target_id, target_label)
    key = rel_key(source_id, rel_type, target_id, date)
    props: dict[str, Any] = {
        "rel_key": key,
        "source_module": source,
        "interpretation": interpretation,
    }
    if date:
        props["date"] = date
    if confidence is not None:
        props["confidence"] = float(confidence)
    if case_id:
        props["case_id"] = case_id
    if evidence_id:
        props["evidence_id"] = evidence_id
    if extra:
        props.update({k: v for k, v in extra.items() if v is not None})

    cypher = (
        f"MATCH (a:{src_label} {{id: $source_id}}) "
        f"MATCH (b:{tgt_label} {{id: $target_id}}) "
        f"MERGE (a)-[r:{rel_type} {{rel_key: $rel_key}}]->(b) "
        "SET r += $props, r.updated_at = datetime() "
        "RETURN type(r) AS type, a.id AS source, b.id AS target, r {.*} AS properties"
    )
    rows = run_write(
        cypher,
        source_id=source_id,
        target_id=target_id,
        rel_key=key,
        props=props,
    )
    if not rows:
        raise ValueError(
            f"Could not create {rel_type} {source_id}->{target_id}. "
            "Both nodes must exist first."
        )
    return rows[0]
