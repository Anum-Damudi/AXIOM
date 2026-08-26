"""Convert Member 1 NLP JSON into Neo4j nodes and fact relationships."""

from __future__ import annotations

from typing import Any

from graph.models import NLP_LABEL_MAP, NODE_LABELS, RELATIONSHIP_TYPES
from graph.nodes import ensure_node, infer_label, upsert_node
from graph.relationships import upsert_relationship

EXAMPLE_NLP_PAYLOAD = {
    "source": "nlp",
    "report_id": "RPT101",
    "case_id": "C101",
    "extracted_at": "2026-08-26T10:00:00Z",
    "text": "Arun met Ravi near Bhatkal on 12 May using vehicle KA-47-AB-1234.",
    "entities": [
        {"id": "P001", "type": "Person", "name": "Arun Sharma", "confidence": 0.96},
        {"id": "P002", "type": "Person", "name": "Ravi Naik", "confidence": 0.95},
        {"id": "L001", "type": "Location", "name": "Bhatkal", "confidence": 0.93},
        {"id": "V001", "type": "Vehicle", "plate_number": "KA-47-AB-1234", "confidence": 0.97},
        {"type": "Date", "value": "2026-05-12"},
    ],
    "relationships": [
        {
            "source_id": "P001",
            "target_id": "P002",
            "type": "MET",
            "date": "2026-05-12",
            "confidence": 0.91,
        },
        {
            "source_id": "P001",
            "target_id": "V001",
            "type": "USED",
            "date": "2026-05-12",
            "confidence": 0.88,
        },
        {
            "source_id": "P001",
            "target_id": "L001",
            "type": "LOCATED_AT",
            "date": "2026-05-12",
            "confidence": 0.84,
        },
    ],
}


def _normalize_label(raw: str | None, entity_id: str | None) -> str | None:
    if not raw and entity_id:
        return infer_label(entity_id)
    if not raw:
        return None
    key = raw.strip().upper()
    if key in NLP_LABEL_MAP:
        return NLP_LABEL_MAP[key]
    titled = raw.strip().title() if raw.strip().lower() != "organization" else "Organization"
    if raw.strip() in NODE_LABELS:
        return raw.strip()
    if titled in NODE_LABELS:
        return titled
    return None


def ingest_nlp(payload: dict[str, Any]) -> dict[str, Any]:
    case_id = payload.get("case_id")
    report_id = payload.get("report_id")
    source = payload.get("source", "nlp")
    created_nodes = []
    created_rels = []
    skipped = []

    if report_id:
        created_nodes.append(
            upsert_node(
                "Report",
                {
                    "id": report_id,
                    "case_id": case_id,
                    "report_text": payload.get("text"),
                    "extracted_at": payload.get("extracted_at"),
                    "source_module": source,
                },
            )
        )
        if case_id:
            ensure_node("Case", case_id, {"title": case_id})
            created_rels.append(
                upsert_relationship(report_id, "DOCUMENTS", case_id, source=source, case_id=case_id)
            )

    event_date = None
    for entity in payload.get("entities") or []:
        label = _normalize_label(entity.get("type") or entity.get("label"), entity.get("id"))
        if label is None:
            if (entity.get("type") or "").upper() == "DATE":
                event_date = entity.get("value") or entity.get("date")
            else:
                skipped.append({"reason": "unsupported_or_date", "entity": entity})
            continue
        props = {k: v for k, v in entity.items() if k not in {"type", "label"} and v is not None}
        if "id" not in props:
            skipped.append({"reason": "missing_stable_id", "entity": entity})
            continue
        created_nodes.append(upsert_node(label, props))
        if report_id:
            created_rels.append(
                upsert_relationship(
                    report_id,
                    "MENTIONS",
                    props["id"],
                    source=source,
                    case_id=case_id,
                    extra={"confidence": entity.get("confidence")},
                )
            )
        if case_id and label in {"Person", "Vehicle", "Location", "Organization", "Evidence"}:
            created_rels.append(
                upsert_relationship(
                    props["id"],
                    "INVOLVED_IN",
                    case_id,
                    source=source,
                    case_id=case_id,
                    extra={"confidence": entity.get("confidence")},
                )
            )

    for rel in payload.get("relationships") or []:
        rel_type = (rel.get("type") or "").upper()
        if rel_type not in RELATIONSHIP_TYPES:
            skipped.append({"reason": "unknown_relationship", "relationship": rel})
            continue
        created_rels.append(
            upsert_relationship(
                rel["source_id"],
                rel_type,
                rel["target_id"],
                source_label=rel.get("source_label"),
                target_label=rel.get("target_label"),
                date=rel.get("date") or event_date,
                confidence=rel.get("confidence"),
                source=source,
                case_id=case_id or rel.get("case_id"),
                evidence_id=rel.get("evidence_id"),
            )
        )

    return {
        "nodes_upserted": len(created_nodes),
        "relationships_upserted": len(created_rels),
        "skipped": skipped,
        "case_id": case_id,
        "report_id": report_id,
        "interpretation": "extracted_fact",
    }
