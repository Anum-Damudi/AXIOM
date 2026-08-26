from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Vehicle
from app.schemas import VehicleResponse, ApiResponse, MetaPagination
from app.core.exceptions import NotFoundException

router = APIRouter()

@router.get("", response_model=ApiResponse[List[VehicleResponse]], tags=["Vehicles"])
def get_vehicles(
    type: Optional[str] = Query(None, description="Filter by type: car, bike, van, truck"),
    keyword: Optional[str] = Query(None, description="Search plate number or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List vehicle entities with filtering and pagination."""
    query = db.query(Vehicle)
    if type:
        query = query.filter(Vehicle.type == type)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter((Vehicle.plate_number.ilike(pattern)) | (Vehicle.id.ilike(pattern)))

    total = query.count()
    vehicles = query.offset((page - 1) * limit).limit(limit).all()
    meta = MetaPagination(page=page, limit=limit, total=total)

    return ApiResponse(success=True, data=[VehicleResponse.model_validate(v) for v in vehicles], meta=meta)

@router.get("/{vehicle_id}", response_model=ApiResponse[VehicleResponse], tags=["Vehicles"])
def get_vehicle(vehicle_id: str, db: Session = Depends(get_db)):
    """Fetch vehicle details by vehicle ID."""
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise NotFoundException(message=f"Vehicle {vehicle_id} not found", code="VEHICLE_NOT_FOUND")
    return ApiResponse(success=True, data=VehicleResponse.model_validate(vehicle))
