from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import CaseTimelineResponse, ApiResponse
from app.services import CaseService

router = APIRouter()

@router.get("/cases/{case_id}/timeline", response_model=ApiResponse[CaseTimelineResponse], tags=["Timeline"])
def get_timeline(case_id: str, db: Session = Depends(get_db)):
    """Fetch chronological timeline of investigation events for a case."""
    timeline = CaseService.get_case_timeline(db, case_id)
    return ApiResponse(success=True, data=timeline)
