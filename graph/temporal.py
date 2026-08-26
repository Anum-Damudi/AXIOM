"""Temporal proximity using relationship dates and Event nodes."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from graph.connection import run_query
from graph.ethics import INVESTIGATIVE_DISCLAIMER


def parse_day(value: str | None) -> date | None:
    if not value:
        return None
    text = str(value)[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def days_apart(a: str | None, b: str | None) -> int | None:
    da, db = parse_day(a), parse_day(b)
    if not da or not db:
        return None
    return abs((da - db).days)


def is_proximate(a: str | None, b: str | None, window_days: int = 14) -> bool:
    gap = days_apart(a, b)
    return gap is not None and gap <= window_days


def event_timeline(case_ids: list[str] | None = None, entity_id: str | None = None) -> dict[str, Any]:
    """Ordered events plus dated relationship facts for Member 5's timeline."""
    if entity_id:
        cypher = (
            "MATCH (n {id: $entity_id}) "
            "OPTIONAL MATCH (n)-[:INVOLVED_IN]->(c:Case) "
            "OPTIONAL MATCH (e:Event)-[:PART_OF]->(c) "
            "WITH collect(DISTINCT e) AS events "
            "UNWIND events AS e "
            "WITH e WHERE e IS NOT NULL "
            "OPTIONAL MATCH (e)-[:OCCURRED_AT]->(loc:Location) "
            "OPTIONAL MATCH (e)-[:PART_OF]->(c:Case) "
            "RETURN e.id AS id, e.event_type AS event_type, e.occurred_on AS occurred_on, "
            "e.description AS description, loc.id AS location_id, loc.name AS location_name, "
            "c.id AS case_id "
            "ORDER BY e.occurred_on"
        )
        rows = run_query(cypher, entity_id=entity_id)
    elif case_ids:
        cypher = (
            "MATCH (e:Event)-[:PART_OF]->(c:Case) "
            "WHERE c.id IN $case_ids "
            "OPTIONAL MATCH (e)-[:OCCURRED_AT]->(loc:Location) "
            "RETURN e.id AS id, e.event_type AS event_type, e.occurred_on AS occurred_on, "
            "e.description AS description, loc.id AS location_id, loc.name AS location_name, "
            "c.id AS case_id "
            "ORDER BY e.occurred_on"
        )
        rows = run_query(cypher, case_ids=case_ids)
    else:
        cypher = (
            "MATCH (e:Event) "
            "OPTIONAL MATCH (e)-[:OCCURRED_AT]->(loc:Location) "
            "OPTIONAL MATCH (e)-[:PART_OF]->(c:Case) "
            "RETURN e.id AS id, e.event_type AS event_type, e.occurred_on AS occurred_on, "
            "e.description AS description, loc.id AS location_id, loc.name AS location_name, "
            "c.id AS case_id "
            "ORDER BY e.occurred_on"
        )
        rows = run_query(cypher)

    items = []
    for row in rows:
        items.append(
            {
                "id": row["id"],
                "kind": "event",
                "event_type": row["event_type"],
                "occurred_on": row["occurred_on"],
                "description": row["description"],
                "location_id": row["location_id"],
                "location_name": row["location_name"],
                "case_id": row["case_id"],
            }
        )
    return {
        "items": items,
        "interpretation": "extracted_fact",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def dated_visits_near(location_id: str, window_days: int = 14) -> dict[str, Any]:
    """People who VISITED the same place within a time window of each other."""
    cypher = (
        "MATCH (p:Person)-[r:VISITED|LOCATED_AT|SEEN_AT]->(loc:Location {id: $location_id}) "
        "WHERE r.date IS NOT NULL "
        "RETURN p.id AS person_id, p.name AS name, type(r) AS rel, r.date AS date "
        "ORDER BY r.date"
    )
    rows = run_query(cypher, location_id=location_id)
    pairs = []
    for i, left in enumerate(rows):
        for right in rows[i + 1 :]:
            if left["person_id"] == right["person_id"]:
                continue
            if is_proximate(left["date"], right["date"], window_days):
                pairs.append(
                    {
                        "person_a": left["person_id"],
                        "person_a_name": left["name"],
                        "person_b": right["person_id"],
                        "person_b_name": right["name"],
                        "location_id": location_id,
                        "date_a": left["date"],
                        "date_b": right["date"],
                        "days_apart": days_apart(left["date"], right["date"]),
                        "potential_connection": (
                            f"Temporal proximity at this location: {left['name']} and "
                            f"{right['name']} have recorded presence within {window_days} days. "
                            "This is an investigative lead, not evidence of a meeting."
                        ),
                    }
                )
    return {
        "location_id": location_id,
        "window_days": window_days,
        "visits": rows,
        "proximate_pairs": pairs,
        "interpretation": "inferred_potential_connection",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }


def case_date_window(case_a_date: str | None, case_b_date: str | None, window_days: int = 14) -> dict[str, Any]:
    gap = days_apart(case_a_date, case_b_date)
    return {
        "days_apart": gap,
        "temporal_overlap": gap is not None and gap <= window_days,
        "window_days": window_days,
    }
