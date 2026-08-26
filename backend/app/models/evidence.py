from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(String, nullable=True)
    analysis_status = Column(String, default="PENDING", index=True)  # PENDING, PROCESSING, COMPLETED, FAILED
    analysis_result = Column(Text, nullable=True)  # JSON formatted object/text detection output
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="evidence")
