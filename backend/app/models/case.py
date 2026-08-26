from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    date = Column(String, nullable=False, index=True)
    status = Column(String, default="open", index=True)  # open, closed, under investigation
    priority = Column(String, default="medium", index=True)  # low, medium, high, critical
    case_type = Column(String, default="general", index=True)
    investigating_officer = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    reports = relationship("CaseReport", back_populates="case", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")

class CaseReport(Base):
    __tablename__ = "case_reports"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    report_text = Column(Text, nullable=False)
    processing_status = Column(String, default="PENDING", index=True)  # PENDING, PROCESSING, COMPLETED, FAILED
    nlp_output = Column(Text, nullable=True)  # JSON text string of extracted raw entities & relationships
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="reports")
