"""Facade used by FastAPI (Member 4) and seed scripts."""

from __future__ import annotations

from typing import Any

from graph import analytics, hidden_links, queries, temporal
from graph.connection import verify_connectivity
from graph.frontend_payload import serialize_graph, serialize_path
from graph.ingest_evidence import ingest_evidence
from graph.ingest_nlp import ingest_nlp
from graph.nodes import upsert_node
from graph.relationships import upsert_relationship
from graph.schema import apply_schema


class GraphService:
    def health(self) -> dict[str, Any]:
        ok = verify_connectivity()
        return {"neo4j": ok}

    def setup(self) -> dict[str, Any]:
        return apply_schema()

    def upsert_entity(self, label: str, properties: dict[str, Any]) -> dict[str, Any]:
        return upsert_node(label, properties)

    def upsert_rel(self, payload: dict[str, Any]) -> dict[str, Any]:
        return upsert_relationship(
            payload["source_id"],
            payload["type"],
            payload["target_id"],
            source_label=payload.get("source_label"),
            target_label=payload.get("target_label"),
            date=payload.get("date"),
            confidence=payload.get("confidence"),
            source=payload.get("source", "api"),
            case_id=payload.get("case_id"),
            evidence_id=payload.get("evidence_id"),
            extra=payload.get("extra"),
        )

    def ingest_nlp(self, payload: dict[str, Any]) -> dict[str, Any]:
        return ingest_nlp(payload)

    def ingest_evidence(self, payload: dict[str, Any]) -> dict[str, Any]:
        return ingest_evidence(payload)

    def entity(self, node_id: str) -> dict[str, Any] | None:
        return queries.get_entity(node_id)

    def search(self, q: str, label: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        return queries.search_entities(q, limit=limit, label=label)

    def neighbors(self, node_id: str, depth: int = 1) -> dict[str, Any]:
        return queries.neighbors(node_id, depth=depth)

    def path(self, source_id: str, target_id: str, max_hops: int = 6) -> dict[str, Any]:
        return serialize_path(source_id, target_id)

    def multi_hop(self, source_id: str, target_id: str) -> dict[str, Any]:
        return queries.multi_hop_paths(source_id, target_id)

    def case_view(self, case_id: str, depth: int = 2) -> dict[str, Any]:
        return serialize_graph(case_id=case_id, depth=depth)

    def case_connections(self, case_id: str) -> dict[str, Any]:
        return {
            "cross_case": queries.cross_case_entities(case_id),
            "hidden_links": hidden_links.hidden_links_for_case(case_id),
        }

    def centrality(self, case_id: str | None = None) -> dict[str, Any]:
        return analytics.centrality(case_id)

    def communities(self, case_id: str | None = None) -> dict[str, Any]:
        return analytics.communities(case_id)

    def hidden_links(self, case_id: str, min_score: int = 20) -> dict[str, Any]:
        return hidden_links.hidden_links_for_case(case_id, min_score=min_score)

    def timeline(self, case_id: str) -> dict[str, Any]:
        return temporal.event_timeline(case_ids=[case_id])


service = GraphService()
