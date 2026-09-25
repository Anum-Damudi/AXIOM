from typing import List
import logging
from fastapi import APIRouter, Depends, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import ApiResponse
from app.schemas.phone import (
    PhoneNumberResponse, CDRImportResponse, CDRImportRequest,
    PhoneProfileResponse, MovementAnalysisResponse, NetworkAnalysisResponse,
    ColocationAnalysisResponse, BurnerDetectionResponse
)
from app.services.phone_service import PhoneService
from app.services.phone_graph_service import PhoneGraphService
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter()
logger = logging.getLogger("axiom.phones")

@router.post("/cases/{case_id}/cdr/import", response_model=ApiResponse[CDRImportResponse], status_code=status.HTTP_201_CREATED, tags=["Phones"])
def import_cdr(
    case_id: str,
    file: UploadFile = File(...),
    operator: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "INVESTIGATOR"))
):
    """Import CDR (Call Detail Record) data from CSV file. Investigator/Admin only."""
    import tempfile
    import os
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name
    
    try:
        cdr_import = PhoneService.import_cdr_csv(
            db,
            case_id=case_id,
            file_path=tmp_path,
            operator=operator,
            uploaded_by=current_user.id
        )
        
        # Sync to Neo4j (gracefully no-ops when Neo4j is offline)
        try:
            PhoneGraphService.sync_call_records_to_graph(db, cdr_import.id)
        except Exception as e:
            logger.warning(f"Neo4j call-record sync skipped for import {cdr_import.id}: {e}")

        from app.services.audit_service import AuditService
        AuditService.log_action(
            db, action="CDR_IMPORT", user_id=current_user.id,
            resource_type="cdr_import", resource_id=cdr_import.id,
            details={"case_id": case_id, "rows": cdr_import.total_records, "operator": operator}
        )
        return ApiResponse(success=True, data=cdr_import)
    finally:
        os.unlink(tmp_path)

@router.get("/phones/{phone_number}/profile", response_model=ApiResponse[PhoneProfileResponse], tags=["Phones"])
def get_phone_profile(phone_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get comprehensive phone profile with call statistics and associations."""
    profile = PhoneService.get_phone_profile(db, phone_number)
    return ApiResponse(success=True, data=profile)

@router.get("/phones/{phone_number}/movement", response_model=ApiResponse[MovementAnalysisResponse], tags=["Phones"])
def analyze_movement(phone_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Analyze phone movement patterns from CDR data."""
    movement = PhoneService.analyze_movement(db, phone_number)
    return ApiResponse(success=True, data=movement)

@router.get("/phones/{phone_number}/network", response_model=ApiResponse[NetworkAnalysisResponse], tags=["Phones"])
def analyze_network(phone_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Analyze phone call network and contact patterns."""
    network = PhoneService.analyze_network(db, phone_number)
    return ApiResponse(success=True, data=network)

@router.post("/phones/colocation", response_model=ApiResponse[ColocationAnalysisResponse], tags=["Phones"])
def analyze_colocation(
    phone_numbers: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze co-location between multiple phones."""
    if len(phone_numbers) < 2:
        raise BadRequestException(message="At least 2 phone numbers required", code="INSUFFICIENT_PHONES")
    
    colocation = PhoneService.analyze_colocation(db, phone_numbers)
    return ApiResponse(success=True, data=colocation)

@router.get("/phones/{phone_number}/burner-detection", response_model=ApiResponse[BurnerDetectionResponse], tags=["Phones"])
def detect_burner(phone_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Detect if a phone is likely a burner phone based on usage patterns."""
    burner = PhoneService.detect_burner(db, phone_number)
    return ApiResponse(success=True, data=burner)

@router.get("/phones/{phone_number}/graph", response_model=ApiResponse[dict], tags=["Phones"])
def get_phone_graph(phone_number: str, depth: int = 2, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get phone network graph from Neo4j."""
    graph = PhoneGraphService.get_phone_network_graph(db, phone_number, depth)
    return ApiResponse(success=True, data=graph)

@router.get("/phones/{phone1}/path/{phone2}", response_model=ApiResponse[dict], tags=["Phones"])
def find_shortest_path(phone1: str, phone2: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Find shortest call path between two phones."""
    path = PhoneGraphService.find_shortest_path(db, phone1, phone2)
    return ApiResponse(success=True, data=path)

@router.get("/cases/{case_id}/cdr-imports", response_model=ApiResponse[List[CDRImportResponse]], tags=["Phones"])
def get_case_cdr_imports(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all CDR imports for a case."""
    from app.models import CDRImport
    imports = db.query(CDRImport).filter(CDRImport.case_id == case_id).all()
    return ApiResponse(success=True, data=[CDRImportResponse.model_validate(i) for i in imports])

@router.get("/cases/{case_id}/phone-intelligence", response_model=ApiResponse[dict], tags=["Phones"])
def get_case_phone_intelligence(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get comprehensive phone network analysis, frequent communication pairs, movement, and burner phone indicators for a case."""
    intel = PhoneService.get_case_phone_intelligence(db, case_id)
    return ApiResponse(success=True, data=intel)
