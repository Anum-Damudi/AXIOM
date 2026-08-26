"""Load data/graph_seed.json into Neo4j."""

from __future__ import annotations

import json
from pathlib import Path

from graph.connection import close_driver, verify_connectivity
from graph.nodes import upsert_node
from graph.relationships import upsert_relationship
from graph.schema import apply_schema

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "graph_seed.json"

LABEL_KEYS = {
    "people": "Person",
    "cases": "Case",
    "vehicles": "Vehicle",
    "locations": "Location",
    "organizations": "Organization",
    "events": "Event",
    "evidence": "Evidence",
    "images": "Image",
    "reports": "Report",
}


def load_seed_file(path: Path | None = None) -> dict:
    seed_path = path or SEED_PATH
    with seed_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def seed(path: Path | None = None, apply_constraints: bool = True) -> dict[str, int]:
    verify_connectivity()
    if apply_constraints:
        apply_schema()
    data = load_seed_file(path)
    counts: dict[str, int] = {}
    for key, label in LABEL_KEYS.items():
        items = data.get(key) or []
        for item in items:
            upsert_node(label, item)
        counts[label] = len(items)
    rels = data.get("relationships") or []
    for rel in rels:
        upsert_relationship(
            rel["source"],
            rel["type"],
            rel["target"],
            date=rel.get("date"),
            confidence=rel.get("confidence"),
            source=rel.get("source_module", "seed"),
            case_id=rel.get("case_id"),
            evidence_id=rel.get("evidence_id"),
            extra={k: v for k, v in rel.items() if k not in {
                "source", "type", "target", "date", "confidence", "case_id", "evidence_id"
            } and k != "source_module"},
        )
    counts["relationships"] = len(rels)
    return counts


if __name__ == "__main__":
    stats = seed()
    print("Seed complete:", stats)
    close_driver()
