from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import (
    CaseCreate, CaseUpdate, CaseResponse, RelatedCaseConnection,
    CytoscapeGraphData, CaseTimelineResponse, ApiResponse, MetaPagination
)
from app.services import CaseService, CrossCaseService, GraphService
from app.api.v1.endpoints.auth import get_current_user_id

router = APIRouter()

@router.post("", response_model=ApiResponse[CaseResponse], status_code=status.HTTP_201_CREATED, tags=["Cases"])
def create_case(
    case_in: CaseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new investigation case."""
    case = CaseService.create_case(db, case_in, user_id=user_id)
    return ApiResponse(success=True, data=case)

@router.get("", response_model=ApiResponse[List[CaseResponse]], tags=["Cases"])
def get_cases(
    status: Optional[str] = Query(None, description="Filter by status: open, closed, under investigation"),
    priority: Optional[str] = Query(None, description="Filter by priority: low, medium, high, critical"),
    keyword: Optional[str] = Query(None, description="Search keyword in case title or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List investigation cases with pagination and filtering."""
    cases, total = CaseService.get_cases(
        db, status=status, priority=priority, keyword=keyword, page=page, limit=limit
    )
    meta = MetaPagination(page=page, limit=limit, total=total)
    return ApiResponse(success=True, data=cases, meta=meta)

@router.get("/{case_id}", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def get_case(case_id: str, db: Session = Depends(get_db)):
    """Fetch case details by case ID."""
    case = CaseService.get_case_by_id(db, case_id)
    return ApiResponse(success=True, data=case)

@router.patch("/{case_id}", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def update_case(
    case_id: str,
    case_in: CaseUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update case status, priority, or details."""
    case = CaseService.update_case(db, case_id, case_in, user_id=user_id)
    return ApiResponse(success=True, data=case)

@router.delete("/{case_id}", response_model=ApiResponse[dict], tags=["Cases"])
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete an investigation case."""
    CaseService.delete_case(db, case_id, user_id=user_id)
    return ApiResponse(success=True, data={"message": f"Case {case_id} successfully deleted."})

@router.get("/{case_id}/related-cases", response_model=ApiResponse[List[RelatedCaseConnection]], tags=["Cases"])
def get_related_cases(case_id: str, db: Session = Depends(get_db)):
    """Cross-case intelligence engine: discover related cases connected through shared people, vehicles, or locations."""
    related = CrossCaseService.get_related_cases(db, case_id)
    return ApiResponse(success=True, data=related)

@router.get("/{case_id}/network", response_model=ApiResponse[CytoscapeGraphData], tags=["Cases"])
def get_case_network(case_id: str, db: Session = Depends(get_db)):
    """Fetch Cytoscape.js formatted knowledge graph subgraph for a case."""
    subgraph = GraphService.get_case_subgraph(db, case_id)
    return ApiResponse(success=True, data=subgraph)

@router.get("/{case_id}/timeline", response_model=ApiResponse[CaseTimelineResponse], tags=["Cases", "Timeline"])
def get_case_timeline(case_id: str, db: Session = Depends(get_db)):
    """Fetch chronological timeline of investigation events for a case."""
    timeline = CaseService.get_case_timeline(db, case_id)
    return ApiResponse(success=True, data=timeline)
