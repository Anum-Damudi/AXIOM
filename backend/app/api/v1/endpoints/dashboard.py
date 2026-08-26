from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import (
    DashboardSummary, DashboardRecentActivity, NetworkSummary,
    CaseResponse, EvidenceResponse, ApiResponse
)
from app.services import DashboardService, CaseService, EvidenceService
from app.models import Evidence

router = APIRouter()

@router.get("/summary", response_model=ApiResponse[DashboardSummary], tags=["Dashboard"])
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Fetch high-level investigator dashboard statistics and entity counts."""
    summary = DashboardService.get_summary(db)
    return ApiResponse(success=True, data=summary)

@router.get("/recent-cases", response_model=ApiResponse[List[CaseResponse]], tags=["Dashboard"])
def get_recent_cases(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    """Fetch recently updated investigation cases for the dashboard widget."""
    cases, _ = CaseService.get_cases(db, page=1, limit=limit)
    return ApiResponse(success=True, data=cases)

@router.get("/recent-evidence", response_model=ApiResponse[List[EvidenceResponse]], tags=["Dashboard"])
def get_recent_evidence(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    """Fetch recently uploaded evidence items for the dashboard widget."""
    evidence_list = db.query(Evidence).order_by(Evidence.created_at.desc()).limit(limit).all()
    return ApiResponse(success=True, data=[EvidenceResponse.model_validate(e) for e in evidence_list])

@router.get("/activity", response_model=ApiResponse[List[DashboardRecentActivity]], tags=["Dashboard"])
def get_dashboard_activity(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Fetch recent system activity and audit trail logs for the dashboard timeline."""
    activity = DashboardService.get_recent_activity(db, limit=limit)
    return ApiResponse(success=True, data=activity)

@router.get("/network-summary", response_model=ApiResponse[NetworkSummary], tags=["Dashboard"])
def get_dashboard_network_summary(db: Session = Depends(get_db)):
    """Fetch network graph metrics summary (key persons & active clusters) for the dashboard widget."""
    summary = DashboardService.get_network_summary(db)
    return ApiResponse(success=True, data=summary)
