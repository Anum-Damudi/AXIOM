from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import EvidenceResponse, ApiResponse
from app.services import EvidenceService
from app.api.v1.endpoints.auth import get_current_user_id

router = APIRouter()

@router.post("/cases/{case_id}/evidence", response_model=ApiResponse[EvidenceResponse], status_code=status.HTTP_201_CREATED, tags=["Evidence"])
def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Upload crime-scene image or file evidence to a case and trigger Computer Vision analysis."""
    evidence = EvidenceService.upload_evidence(db, case_id=case_id, file=file, uploader_id=user_id)
    return ApiResponse(success=True, data=evidence)

@router.get("/cases/{case_id}/evidence", response_model=ApiResponse[List[EvidenceResponse]], tags=["Evidence"])
def get_case_evidence(case_id: str, db: Session = Depends(get_db)):
    """Fetch list of all evidence items associated with a case."""
    evidence_list = EvidenceService.get_case_evidence(db, case_id=case_id)
    return ApiResponse(success=True, data=evidence_list)

@router.get("/evidence/{evidence_id}", response_model=ApiResponse[EvidenceResponse], tags=["Evidence"])
def get_evidence(evidence_id: str, db: Session = Depends(get_db)):
    """Fetch details and Computer Vision analysis results for a specific evidence item."""
    evidence = EvidenceService.get_evidence_by_id(db, evidence_id=evidence_id)
    return ApiResponse(success=True, data=evidence)

@router.delete("/evidence/{evidence_id}", response_model=ApiResponse[dict], tags=["Evidence"])
def delete_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete an evidence item."""
    EvidenceService.delete_evidence(db, evidence_id=evidence_id, user_id=user_id)
    return ApiResponse(success=True, data={"message": f"Evidence {evidence_id} successfully deleted."})
