"""Explainable cross-case potential-link scoring.

Inferences are computed on read. They are never stored as fact edges.
"""

from __future__ import annotations

from typing import Any

from graph.connection import run_query
from graph.ethics import INVESTIGATIVE_DISCLAIMER
from graph.queries import shortest_path
from graph.temporal import case_date_window

WEIGHTS = {
    "shared_person": 22,
    "shared_vehicle": 20,
    "shared_location": 12,
    "shared_organization": 15,
    "shared_evidence": 16,
    "temporal_proximity": 10,
    "short_path": 12,
}

TYPE_REASON = {
    "Person": "Shared person",
    "Vehicle": "Shared vehicle",
    "Location": "Location overlap",
    "Organization": "Shared organization",
    "Evidence": "Shared evidence",
}


def _shared_entities(case_a: str, case_b: str) -> list[dict[str, Any]]:
    cypher = (
        "MATCH (a:Case {id: $case_a})<-[:INVOLVED_IN]-(n)-[:INVOLVED_IN]->(b:Case {id: $case_b}) "
        "RETURN n.id AS id, labels(n)[0] AS node_type, "
        "coalesce(n.name, n.title, n.plate_number, n.id) AS display"
    )
    return run_query(cypher, case_a=case_a, case_b=case_b)


def _case_meta(case_id: str) -> dict[str, Any]:
    rows = run_query(
        "MATCH (c:Case {id: $id}) RETURN c.id AS id, c.title AS title, c.date AS date, c.status AS status",
        id=case_id,
    )
    return rows[0] if rows else {"id": case_id, "title": None, "date": None, "status": None}


def score_pair(case_a: str, case_b: str, window_days: int = 14) -> dict[str, Any]:
    if case_a == case_b:
        raise ValueError("Cannot score a case against itself")

    shared = _shared_entities(case_a, case_b)
    reasons: list[str] = []
    breakdown: list[dict[str, Any]] = []
    score = 0.0

    type_counts: dict[str, int] = {}
    for item in shared:
        type_counts[item["node_type"]] = type_counts.get(item["node_type"], 0) + 1

    for node_type, count in type_counts.items():
        key = {
            "Person": "shared_person",
            "Vehicle": "shared_vehicle",
            "Location": "shared_location",
            "Organization": "shared_organization",
            "Evidence": "shared_evidence",
        }.get(node_type)
        if not key:
            continue
        # Diminishing returns after the first shared entity of a type
        points = WEIGHTS[key] + max(0, count - 1) * (WEIGHTS[key] * 0.25)
        score += points
        reason = TYPE_REASON[node_type]
        if reason not in reasons:
            reasons.append(reason)
        breakdown.append(
            {
                "factor": key,
                "points": round(points, 2),
                "count": count,
                "entities": [s for s in shared if s["node_type"] == node_type],
            }
        )

    meta_a = _case_meta(case_a)
    meta_b = _case_meta(case_b)
    temporal = case_date_window(meta_a.get("date"), meta_b.get("date"), window_days)
    if temporal["temporal_overlap"]:
        score += WEIGHTS["temporal_proximity"]
        reasons.append("Temporal proximity")
        breakdown.append(
            {
                "factor": "temporal_proximity",
                "points": WEIGHTS["temporal_proximity"],
                "days_apart": temporal["days_apart"],
            }
        )

    path = shortest_path(case_a, case_b, max_hops=6)
    if path.get("found"):
        hops = path["hops"] or 99
        path_points = max(0.0, WEIGHTS["short_path"] - (hops - 1) * 2)
        score += path_points
        breakdown.append(
            {
                "factor": "path_length",
                "points": round(path_points, 2),
                "hops": hops,
            }
        )
        confidences = [
            e.get("properties", {}).get("confidence")
            for e in path.get("edges", [])
            if e.get("properties", {}).get("confidence") is not None
        ]
        if confidences:
            avg_c = sum(confidences) / len(confidences)
            conf_points = round(avg_c * 8, 2)
            score += conf_points
            breakdown.append(
                {
                    "factor": "relationship_confidence",
                    "points": conf_points,
                    "average_confidence": round(avg_c, 3),
                }
            )

    score = int(max(0, min(100, round(score))))
    path_ids = path.get("path_ids") if path.get("found") else []

    return {
        "case_a": case_a,
        "case_b": case_b,
        "case_a_title": meta_a.get("title"),
        "case_b_title": meta_b.get("title"),
        "potential_link_score": score,
        "reasons": reasons or ["No shared entities found at INVOLVED_IN overlap"],
        "shared_entities": shared,
        "path": path_ids,
        "path_detail": path if path.get("found") else None,
        "score_breakdown": breakdown,
        "temporal": temporal,
        "interpretation": "inferred_potential_connection",
        "label": "investigative_lead",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def hidden_links_for_case(case_id: str, min_score: int = 20, limit: int = 10) -> dict[str, Any]:
    """Compare this case to every other case that shares at least one entity or a short path."""
    cypher = (
        "MATCH (c:Case {id: $case_id}) "
        "OPTIONAL MATCH (c)<-[:INVOLVED_IN]-(n)-[:INVOLVED_IN]->(other:Case) "
        "WHERE other.id <> c.id "
        "WITH collect(DISTINCT other.id) AS overlapping "
        "MATCH (all:Case) "
        "WHERE all.id <> $case_id "
        "RETURN collect(DISTINCT all.id) AS all_ids, overlapping"
    )
    rows = run_query(cypher, case_id=case_id)
    if not rows:
        return {"case_id": case_id, "links": [], "disclaimer": INVESTIGATIVE_DISCLAIMER}

    overlapping = set(rows[0]["overlapping"] or [])
    all_ids = rows[0]["all_ids"] or []
    # Score overlapping cases first, then a few others for completeness
    candidates = list(overlapping) + [cid for cid in all_ids if cid not in overlapping]

    links = []
    for other in candidates:
        result = score_pair(case_id, other)
        if result["potential_link_score"] >= min_score:
            links.append(result)

    links.sort(key=lambda x: x["potential_link_score"], reverse=True)
    return {
        "case_id": case_id,
        "links": links[:limit],
        "interpretation": "inferred_potential_connection",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }
