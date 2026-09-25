import os
import json
import sys
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.evidence import Evidence
from app.services.audit_service import AuditService
from app.core.config import settings

logger = logging.getLogger("axiom.cv")


def resolve_cv_module_dir() -> Path:
    """Locate the cv-module directory (env override, then relative discovery)."""
    if getattr(settings, "CV_MODULE_PATH", ""):
        candidate = Path(settings.CV_MODULE_PATH).resolve()
        if candidate.exists():
            return candidate
    # backend/app/services/cv_service.py -> <repo>/cv-module
    here = Path(__file__).resolve()
    candidate = here.parents[2] / "cv-module"
    if candidate.exists():
        return candidate
    # fallback relative to current working directory
    cwd = Path.cwd().resolve()
    if (cwd.parent / "cv-module").exists():
        return cwd.parent / "cv-module"
    if (cwd / "cv-module").exists():
        return cwd / "cv-module"
    return None


def _run_module(image_path: str) -> Dict[str, Any]:
    """Invoke the standalone CV processor and read the machine-readable JSON it writes.

    Never fabricates results: on any failure returns an explicit MODEL_UNAVAILABLE
    state carrying the reason. Output schema matches cv-module/README_CV.md.
    """
    module_dir = resolve_cv_module_dir()
    if module_dir is None:
        return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
                "reason": "cv-module directory not found"}
    processor = module_dir / "evidence_processor.py"
    if not processor.exists():
        return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
                "reason": "evidence_processor.py missing in cv-module"}

    image_stem = Path(image_path).stem
    json_path = module_dir / "evidence" / f"{image_stem}.json"
    try:
        proc = subprocess.run(
            [sys.executable, str(processor), image_path],
            cwd=str(module_dir),
            capture_output=True,
            text=True,
            timeout=settings.CV_ANALYSIS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        logger.error(f"CV analysis timed out for {image_path}")
        return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
                "reason": "analysis timed out"}
    except Exception as e:
        logger.error(f"CV analysis subprocess error: {e}")
        return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
                "reason": str(e)}

    if proc.returncode != 0:
        logger.warning(f"CV processor exited with code {proc.returncode}: {proc.stderr[-1500:]}")
        return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
                "reason": f"processor exit code {proc.returncode}"}

    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            data["processing_status"] = "completed"
            data["model"] = "cv-module (YOLO26n + PaddleOCR)"
            return data
        except Exception as e:
            return {"objects": [], "text": [], "processing_status": "FAILED", "reason": str(e)}

    return {"objects": [], "text": [], "processing_status": "MODEL_UNAVAILABLE",
            "reason": "processor produced no evidence JSON"}


class CvService:
    @staticmethod
    def analyze_evidence(db: Session, evidence_id: str) -> Evidence:
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")

        if not evidence.file_path or not evidence.mime_type or not evidence.mime_type.startswith("image/"):
            evidence.analysis_status = "SKIPPED"
            evidence.analysis_result = json.dumps({
                "objects": [], "text": [],
                "processing_status": "skipped",
                "reason": "Not an image evidence item",
            })
            db.commit()
            return evidence

        evidence.analysis_status = "PROCESSING"
        db.commit()

        result = _run_module(evidence.file_path)

        if result.get("processing_status") in ("MODEL_UNAVAILABLE", "FAILED"):
            evidence.analysis_status = result.get("processing_status")
            evidence.analysis_result = json.dumps(result)
            db.commit()
            AuditService.log_action(
                db, action="CV_ANALYSIS_UNAVAILABLE", resource_type="evidence",
                resource_id=evidence.id,
                details={"reason": result.get("reason"), "case_id": evidence.case_id}
            )
            return evidence

        evidence.analysis_status = "COMPLETED"
        evidence.analysis_result = json.dumps(result)
        db.commit()

        AuditService.log_action(
            db, action="CV_EVIDENCE_ANALYZED", resource_type="evidence",
            resource_id=evidence.id,
            details={
                "case_id": evidence.case_id,
                "objects_detected": len(result.get("objects", [])),
                "text_regions": len(result.get("text", [])),
            }
        )
        return evidence