"""Convert Member 3 computer-vision / evidence JSON into Neo4j facts."""

from __future__ import annotations

from typing import Any

from graph.nodes import ensure_node, upsert_node
from graph.relationships import upsert_relationship

EXAMPLE_EVIDENCE_PAYLOAD = {
    "source": "cv",
    "case_id": "C101",
    "evidence_id": "EV101",
    "evidence_type": "image",
    "description": "Roadside still showing a white van near Bhatkal bus stand",
    "image": {
        "id": "IMG101",
        "path": "synthetic/img101.jpg",
        "captured_on": "2026-05-12",
        "detected_objects": ["van", "person"],
        "visible_text": ["KA-47-AB-1234"],
    },
    "linked_entities": [
        {"id": "V001", "reason": "plate_text"},
        {"id": "L001", "reason": "scene_location"},
    ],
}


def ingest_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    source = payload.get("source", "cv")
    case_id = payload["case_id"]
    evidence_id = payload["evidence_id"]
    created = []

    ensure_node("Case", case_id, {"title": payload.get("case_title") or case_id})
    created.append(
        upsert_node(
            "Evidence",
            {
                "id": evidence_id,
                "evidence_type": payload.get("evidence_type", "unknown"),
                "description": payload.get("description"),
                "case_id": case_id,
                "source_module": source,
            },
        )
    )
    created.append(
        upsert_relationship(evidence_id, "SUPPORTS", case_id, source=source, case_id=case_id)
    )
    created.append(
        upsert_relationship(evidence_id, "INVOLVED_IN", case_id, source=source, case_id=case_id)
    )

    image = payload.get("image") or {}
    if image.get("id"):
        created.append(
            upsert_node(
                "Image",
                {
                    "id": image["id"],
                    "path": image.get("path"),
                    "captured_on": image.get("captured_on"),
                    "detected_objects": ",".join(image.get("detected_objects") or []),
                    "visible_text": image.get("visible_text")
                    if isinstance(image.get("visible_text"), str)
                    else ",".join(image.get("visible_text") or []),
                    "source_module": source,
                },
            )
        )
        created.append(
            upsert_relationship(
                image["id"],
                "DEPICTS",
                evidence_id,
                source=source,
                case_id=case_id,
                evidence_id=evidence_id,
            )
        )

    for link in payload.get("linked_entities") or []:
        created.append(
            upsert_relationship(
                evidence_id,
                "MENTIONS",
                link["id"],
                source=source,
                case_id=case_id,
                evidence_id=evidence_id,
                extra={"reason": link.get("reason")},
            )
        )

    return {
        "evidence_id": evidence_id,
        "case_id": case_id,
        "items_written": len(created),
        "interpretation": "extracted_fact",
    }
