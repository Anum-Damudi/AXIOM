from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas import ApiResponse

router = APIRouter(tags=["Audit"])


@router.get("", response_model=ApiResponse, tags=["Audit"])
def list_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: inspect the immutable audit trail with optional filters."""
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        query = query.filter(AuditLog.resource_type.ilike(f"%{resource_type}%"))

    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc())\
        .offset((page - 1) * limit).limit(limit).all()

    def serialize(log):
        return {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }

    return ApiResponse(
        success=True,
        data={"logs": [serialize(l) for l in logs], "total": total, "page": page, "limit": limit}
    )