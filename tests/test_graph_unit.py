"""Unit tests that do not require a running Neo4j instance."""

from graph.ingest_nlp import EXAMPLE_NLP_PAYLOAD, _normalize_label
from graph.models import RELATIONSHIP_TYPES
from graph.relationships import rel_key
from graph.temporal import days_apart, is_proximate, parse_day


def test_rel_key_is_stable():
    assert rel_key("P001", "MET", "P002", "2026-05-12") == "P001|MET|P002|2026-05-12"
    assert rel_key("P001", "MET", "P002", None) != rel_key("P001", "MET", "P002", "2026-05-12")


def test_temporal_proximity():
    assert parse_day("2026-05-12") is not None
    assert days_apart("2026-05-12", "2026-05-18") == 6
    assert is_proximate("2026-05-12", "2026-05-18", window_days=14)
    assert not is_proximate("2026-01-10", "2026-05-12", window_days=14)


def test_nlp_label_normalization():
    assert _normalize_label("PERSON", "P001") == "Person"
    assert _normalize_label("DATE", None) is None
    assert _normalize_label("Vehicle", "V001") == "Vehicle"


def test_example_nlp_payload_uses_allowed_relationships():
    for rel in EXAMPLE_NLP_PAYLOAD["relationships"]:
        assert rel["type"] in RELATIONSHIP_TYPES


def test_seed_file_counts():
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "data" / "graph_seed.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert len(data["people"]) == 20
    assert len(data["cases"]) == 10
    assert len(data["vehicles"]) == 10
    assert len(data["locations"]) == 15
    assert len(data["organizations"]) >= 3
    ids = {p["id"] for p in data["people"]}
    assert "P001" in ids and "P002" in ids
    case_ids = {c["id"] for c in data["cases"]}
    assert {"C101", "C287", "C204"} <= case_ids
    v001_cases = {
        r["target"]
        for r in data["relationships"]
        if r["source"] == "V001" and r["type"] == "INVOLVED_IN"
    }
    assert {"C101", "C287", "C204"} <= v001_cases
