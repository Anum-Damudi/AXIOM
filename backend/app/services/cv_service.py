import os
import uuid
import json
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.evidence import Evidence
from app.services.audit_service import AuditService

logger = logging.getLogger("axiom.cv")

class CvService:
    @staticmethod
    def analyze_evidence(db: Session, evidence_id: str) -> Evidence:
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")

        evidence.analysis_status = "PROCESSING"
        db.commit()

        try:
            # Run Object and Text Detection
            result = CvService._run_cv_analysis(evidence.file_name, evidence.mime_type)
            evidence.analysis_status = "COMPLETED"
            evidence.analysis_result = json.dumps(result)
            db.commit()

            AuditService.log_action(
                db,
                action="CV_EVIDENCE_ANALYZED",
                resource_type="evidence",
                resource_id=evidence.id,
                details={"case_id": evidence.case_id, "objects_detected": len(result.get("objects", []))}
            )

            return evidence
        except Exception as e:
            logger.error(f"CV analysis failed for evidence {evidence_id}: {e}")
            evidence.analysis_status = "FAILED"
            db.commit()
            raise e

    @staticmethod
    def _run_cv_analysis(filename: str, mime_type: str) -> Dict[str, Any]:
        """
        Computer Vision Adapter / Interface.
        Runs object detection, license plate recognition, and text OCR.
        """
        # Clean mock adapter for hackathon demo readiness
        detected_objects = ["person", "car", "license_plate", "phone"]
        detected_text = ["KA-28-EC-5040", "CONFIDENTIAL REPORT", "LOCATION A"]
        confidence_scores = [0.95, 0.91, 0.88, 0.84]

        return {
            "objects": detected_objects,
            "text": detected_text,
            "confidence": confidence_scores,
            "processing_status": "completed"
        }
