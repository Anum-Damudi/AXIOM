"""FastAPI router for Member 4 to mount: app.include_router(graph_router)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from graph.graph_service import service

graph_router = APIRouter(prefix="/graph", tags=["graph"])


class EntityIn(BaseModel):
    label: str
    properties: dict[str, Any]


class RelationshipIn(BaseModel):
    source_id: str
    type: str
    target_id: str
    source_label: str | None = None
    target_label: str | None = None
    date: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    source: str = "api"
    case_id: str | None = None
    evidence_id: str | None = None
    extra: dict[str, Any] | None = None


class PathQuery(BaseModel):
    source_id: str
    target_id: str
    max_hops: int = 6


@graph_router.get("/health")
def health() -> dict[str, Any]:
    try:
        return service.health()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@graph_router.post("/setup")
def setup() -> dict[str, Any]:
    return service.setup()


@graph_router.post("/entities")
def post_entities(body: EntityIn) -> dict[str, Any]:
    try:
        return service.upsert_entity(body.label, body.properties)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@graph_router.post("/relationships")
def post_relationships(body: RelationshipIn) -> dict[str, Any]:
    try:
        return service.upsert_rel(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@graph_router.post("/ingest/nlp")
def post_nlp(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return service.ingest_nlp(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@graph_router.post("/ingest/evidence")
def post_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return service.ingest_evidence(payload)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@graph_router.get("/search")
def search(
    q: str,
    label: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    return {"query": q, "results": service.search(q, label=label, limit=limit)}


@graph_router.get("/entity/{node_id}")
def get_entity(node_id: str) -> dict[str, Any]:
    node = service.entity(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Entity not found")
    return node


@graph_router.get("/neighbors/{node_id}")
def get_neighbors(node_id: str, depth: int = Query(default=1, ge=1, le=4)) -> dict[str, Any]:
    return service.neighbors(node_id, depth=depth)


@graph_router.get("/path")
def get_path(source_id: str, target_id: str, max_hops: int = 6) -> dict[str, Any]:
    return service.path(source_id, target_id, max_hops=max_hops)


@graph_router.post("/path")
def post_path(body: PathQuery) -> dict[str, Any]:
    return service.path(body.source_id, body.target_id, max_hops=body.max_hops)


@graph_router.get("/case/{case_id}")
def get_case(case_id: str, depth: int = Query(default=2, ge=1, le=4)) -> dict[str, Any]:
    return service.case_view(case_id, depth=depth)


@graph_router.get("/case/{case_id}/connections")
def get_case_connections(case_id: str) -> dict[str, Any]:
    return service.case_connections(case_id)


@graph_router.get("/case/{case_id}/timeline")
def get_timeline(case_id: str) -> dict[str, Any]:
    return service.timeline(case_id)


@graph_router.get("/analytics/centrality")
def get_centrality(case_id: str | None = None) -> dict[str, Any]:
    return service.centrality(case_id)


@graph_router.get("/analytics/communities")
def get_communities(case_id: str | None = None) -> dict[str, Any]:
    return service.communities(case_id)


@graph_router.get("/hidden-links")
def get_hidden_links(
    case_id: str,
    min_score: int = Query(default=20, ge=0, le=100),
) -> dict[str, Any]:
    return service.hidden_links(case_id, min_score=min_score)
