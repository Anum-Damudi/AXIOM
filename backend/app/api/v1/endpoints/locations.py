from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Location
from app.schemas import LocationResponse, ApiResponse, MetaPagination
from app.core.exceptions import NotFoundException

router = APIRouter()

@router.get("", response_model=ApiResponse[List[LocationResponse]], tags=["Locations"])
def get_locations(
    keyword: Optional[str] = Query(None, description="Search location name or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List location entities with filtering and pagination."""
    query = db.query(Location)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter((Location.name.ilike(pattern)) | (Location.id.ilike(pattern)))

    total = query.count()
    locations = query.offset((page - 1) * limit).limit(limit).all()
    meta = MetaPagination(page=page, limit=limit, total=total)

    return ApiResponse(success=True, data=[LocationResponse.model_validate(l) for l in locations], meta=meta)

@router.get("/{location_id}", response_model=ApiResponse[LocationResponse], tags=["Locations"])
def get_location(location_id: str, db: Session = Depends(get_db)):
    """Fetch location details by location ID."""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise NotFoundException(message=f"Location {location_id} not found", code="LOCATION_NOT_FOUND")
    return ApiResponse(success=True, data=LocationResponse.model_validate(location))
