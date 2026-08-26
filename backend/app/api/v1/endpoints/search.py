from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import UnifiedSearchResponse, ApiResponse
from app.services import SearchService

router = APIRouter()

@router.get("", response_model=ApiResponse[UnifiedSearchResponse], tags=["Search"])
def unified_search(
    q: str = Query(..., min_length=1, description="Search query string across cases, reports, people, vehicles, locations, and evidence"),
    db: Session = Depends(get_db)
):
    """Unified Investigation Search across cases, people, vehicles, locations, and evidence metadata."""
    results = SearchService.unified_search(db, q)
    return ApiResponse(success=True, data=results)
