import os
import uuid
import logging
from typing import List
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import Evidence, Case
from app.schemas.evidence import EvidenceResponse
from app.services.cv_service import CvService
from app.services.audit_service import AuditService
from app.core.exceptions import NotFoundException, BadRequestException

logger = logging.getLogger("axiom.evidence")

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff",
    "application/pdf", "text/plain"
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

class EvidenceService:
    @staticmethod
    def upload_evidence(db: Session, case_id: str, file: UploadFile, uploader_id: str = None) -> EvidenceResponse:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        if file.content_type not in ALLOWED_MIME_TYPES:
            raise BadRequestException(message=f"File type {file.content_type} not supported.", code="INVALID_FILE_TYPE")

        # Create upload folder if not exists
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
        file_ext = os.path.splitext(file.filename)[1]
        safe_filename = f"{evidence_id}{file_ext}"
        target_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

        file_content = file.file.read()
        file_size = len(file_content)

        if file_size > MAX_FILE_SIZE_BYTES:
            raise BadRequestException(message="File size exceeds maximum 50MB limit.", code="FILE_TOO_LARGE")

        with open(target_path, "wb") as f:
            f.write(file_content)

        evidence = Evidence(
            id=evidence_id,
            case_id=case_id,
            title=file.filename,
            file_name=safe_filename,
            file_path=target_path,
            mime_type=file.content_type,
            file_size=file_size,
            uploaded_by=uploader_id or "Officer Investigator",
            analysis_status="PENDING"
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)

        # Trigger background/inline Computer Vision analysis
        if file.content_type.startswith("image/"):
            try:
                CvService.analyze_evidence(db, evidence.id)
                db.refresh(evidence)
            except Exception as e:
                logger.error(f"Automatic CV analysis failed for evidence {evidence.id}: {e}")

        AuditService.log_action(db, action="EVIDENCE_UPLOAD", user_id=uploader_id, resource_type="evidence", resource_id=evidence.id)

        return EvidenceResponse.model_validate(evidence)

    @staticmethod
    def get_case_evidence(db: Session, case_id: str) -> List[EvidenceResponse]:
        evidence_list = db.query(Evidence).filter(Evidence.case_id == case_id).all()
        return [EvidenceResponse.model_validate(e) for e in evidence_list]

    @staticmethod
    def get_evidence_by_id(db: Session, evidence_id: str) -> EvidenceResponse:
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise NotFoundException(message=f"Evidence {evidence_id} not found", code="EVIDENCE_NOT_FOUND")
        return EvidenceResponse.model_validate(evidence)

    @staticmethod
    def delete_evidence(db: Session, evidence_id: str, user_id: str = None):
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise NotFoundException(message=f"Evidence {evidence_id} not found", code="EVIDENCE_NOT_FOUND")

        if os.path.exists(evidence.file_path):
            try:
                os.remove(evidence.file_path)
            except Exception as e:
                logger.error(f"Failed to delete file from disk: {e}")

        db.delete(evidence)
        db.commit()

        AuditService.log_action(db, action="EVIDENCE_DELETE", user_id=user_id, resource_type="evidence", resource_id=evidence_id)
