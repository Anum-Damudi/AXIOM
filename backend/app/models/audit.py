from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)  # LOGIN, CREATE_CASE, UPLOAD_EVIDENCE, NLP_EXTRACT, etc.
    resource_type = Column(String, nullable=True, index=True)  # case, report, evidence, user, entity
    resource_id = Column(String, nullable=True, index=True)
    details = Column(Text, nullable=True)  # JSON or text description
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
