from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import NetworkMetricResult, CommunityClusterResult, HiddenLinkResult, ApiResponse
from app.services import AnalyticsService

router = APIRouter()

@router.get("/key-persons", response_model=ApiResponse[List[NetworkMetricResult]], tags=["Analytics"])
def get_key_persons(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Network Intelligence: Identify central figure entities via degree & betweenness centrality."""
    results = AnalyticsService.get_key_persons(db, limit=limit)
    return ApiResponse(success=True, data=results)

@router.get("/communities", response_model=ApiResponse[List[CommunityClusterResult]], tags=["Analytics"])
def get_communities(db: Session = Depends(get_db)):
    """Network Intelligence: Detect community clusters and sub-networks among entities."""
    results = AnalyticsService.get_communities(db)
    return ApiResponse(success=True, data=results)

@router.get("/hidden-links", response_model=ApiResponse[List[HiddenLinkResult]], tags=["Analytics"])
def get_hidden_links(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Network Intelligence: Discover indirect hidden relationships between entities who never directly interacted."""
    results = AnalyticsService.get_hidden_links(db, limit=limit)
    return ApiResponse(success=True, data=results)
