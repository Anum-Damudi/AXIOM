from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, status, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import EvidenceResponse, ApiResponse, BatchUploadResponse, EvidenceSuggestionResponse, SuggestionActionRequest
from app.services import EvidenceService
from app.core.security import get_current_user, require_roles
from app.models import User
from app.services.ledger_service import LedgerService
from app.models.ledger import EntryType

router = APIRouter()

READ_ROLES = require_roles("ADMIN", "INVESTIGATOR", "OFFICER")
WRITE_ROLES = require_roles("ADMIN", "INVESTIGATOR")


@router.post(
    "/cases/{case_id}/evidence",
    response_model=ApiResponse[EvidenceResponse],
    status_code=status.HTTP_201_CREATED,
    tags=["Evidence"]
)
def upload_evidence(
    case_id: str,
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
    evidence_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    date: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    status_field: Optional[str] = Form(None, alias="status"),
    related_entity_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Upload evidence to a case. File is optional; metadata-only records are supported. (Admin/Investigator)"""
    evidence = EvidenceService.upload_evidence(
        db,
        case_id=case_id,
        file=file,
        uploader_id=current_user.id,
        title=title,
        evidence_type=evidence_type,
        description=description,
        date=date,
        source=source,
        status=status_field,
        related_entity_id=related_entity_id,
    )
    return ApiResponse(success=True, data=evidence)


@router.post(
    "/cases/{case_id}/evidence/batch",
    response_model=ApiResponse[BatchUploadResponse],
    status_code=status.HTTP_201_CREATED,
    tags=["Evidence"]
)
def upload_evidence_batch(
    case_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Batch upload multiple evidence files to a case with duplicate detection. (Admin/Investigator)"""
    result = EvidenceService.upload_batch(db, case_id=case_id, files=files, uploader_id=current_user.id)
    return ApiResponse(success=True, data=result)


@router.get(
    "/cases/{case_id}/evidence",
    response_model=ApiResponse[List[EvidenceResponse]],
    tags=["Evidence"]
)
def get_case_evidence(
    case_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch list of all evidence items associated with a case with optional category filtering and search."""
    evidence_list = EvidenceService.get_case_evidence(db, case_id=case_id, evidence_type=category, search=search)
    return ApiResponse(success=True, data=evidence_list)


@router.get(
    "/evidence/{evidence_id}",
    response_model=ApiResponse[EvidenceResponse],
    tags=["Evidence"]
)
def get_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch details for a specific evidence item."""
    evidence = EvidenceService.get_evidence_by_id(db, evidence_id=evidence_id)
    return ApiResponse(success=True, data=evidence)


@router.get(
    "/evidence/{evidence_id}/verify",
    response_model=ApiResponse[dict],
    tags=["Evidence"]
)
def verify_evidence_integrity(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Verify evidence integrity by recalculating cryptographic hash and checking ledger chain."""
    status_res, stored_hash, computed_hash = LedgerService.verify_evidence(db, evidence_id)
    chain_valid, _ = LedgerService.verify_chain(db)
    is_valid = (status_res == "INTACT") and chain_valid

    return ApiResponse(
        success=True,
        data={
            "valid": is_valid,
            "evidence_id": evidence_id,
            "status": status_res,
            "stored_hash": stored_hash,
            "calculated_hash": computed_hash,
            "chain_valid": chain_valid
        }
    )


@router.get(
    "/evidence/{evidence_id}/suggestions",
    response_model=ApiResponse[List[EvidenceSuggestionResponse]],
    tags=["Evidence"]
)
def get_evidence_suggestions(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch AI-generated suggestions for an evidence item."""
    from app.models import EvidenceSuggestion
    suggestions = db.query(EvidenceSuggestion).filter(EvidenceSuggestion.evidence_id == evidence_id).all()
    return ApiResponse(success=True, data=[EvidenceSuggestionResponse.model_validate(s) for s in suggestions])


@router.post(
    "/suggestions/{suggestion_id}/action",
    response_model=ApiResponse[EvidenceSuggestionResponse],
    tags=["Evidence"]
)
def act_on_suggestion(
    suggestion_id: str,
    request: SuggestionActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Confirm or reject an evidence suggestion (Admin/Investigator)."""
    if request.action == "confirm":
        suggestion = EvidenceService.confirm_suggestion(db, suggestion_id, current_user.id, request.reason)
    elif request.action == "reject":
        suggestion = EvidenceService.reject_suggestion(db, suggestion_id, current_user.id, request.reason)
    else:
        from app.core.exceptions import BadRequestException
        raise BadRequestException(message="Invalid action. Must be 'confirm' or 'reject'.", code="INVALID_ACTION")

    return ApiResponse(success=True, data=EvidenceSuggestionResponse.model_validate(suggestion))


@router.delete(
    "/evidence/{evidence_id}",
    response_model=ApiResponse[dict],
    tags=["Evidence"]
)
def delete_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Delete an evidence item (Admin/Investigator)."""
    EvidenceService.delete_evidence(db, evidence_id=evidence_id, user_id=current_user.id)
    return ApiResponse(success=True, data={"message": f"Evidence {evidence_id} successfully deleted."})
