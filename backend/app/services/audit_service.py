import uuid
import json
import logging
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

logger = logging.getLogger("axiom.audit")

class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        user_id: str = None,
        resource_type: str = None,
        resource_id: str = None,
        details: dict = None,
        ip_address: str = None
    ) -> AuditLog:
        try:
            audit_entry = AuditLog(
                id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=json.dumps(details) if details else None,
                ip_address=ip_address
            )
            db.add(audit_entry)
            db.commit()
            return audit_entry
        except Exception as e:
            logger.error(f"Failed to record audit log: {e}")
            db.rollback()
            return None
