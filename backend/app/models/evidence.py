from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.core.database import Base


class SuggestionType(str, Enum):
    PLATE_MATCH = "PLATE_MATCH"
    GPS_MATCH = "GPS_MATCH"
    OBJECT_MATCH = "OBJECT_MATCH"


class SuggestionStatus(str, Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)

    # User-supplied metadata
    title = Column(String, nullable=True)
    evidence_type = Column(String, nullable=True, index=True)   # Document, Photograph/Media, etc.
    description = Column(Text, nullable=True)
    date = Column(String, nullable=True)                         # Evidence date (user-supplied)
    source = Column(String, nullable=True)                       # e.g. "Field Investigation"
    status = Column(String, default="Pending", index=True)       # Pending, Under Review, Verified, Archived
    related_entity_id = Column(String, nullable=True, index=True)

    # File metadata (optional — may be null for metadata-only records)
    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    uploaded_by = Column(String, nullable=True)
    analysis_status = Column(String, default="PENDING", index=True)  # PENDING, PROCESSING, COMPLETED, FAILED
    analysis_result = Column(Text, nullable=True)                     # JSON formatted object/text detection output
    sha256 = Column(String, nullable=True, index=True)               # SHA-256 hash for integrity verification
    perceptual_hash = Column(String, nullable=True, index=True)       # Perceptual hash for duplicate detection
    thumbnail_path = Column(String, nullable=True)                    # Path to generated thumbnail
    exif_data = Column(Text, nullable=True)                           # EXIF metadata as JSON
    current_custodian = Column(String, nullable=True)                 # Current custodian of evidence
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="evidence")


class EvidenceSuggestion(Base):
    __tablename__ = "evidence_suggestions"

    id = Column(String, primary_key=True, index=True)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    suggestion_type = Column(String, nullable=False, index=True)
    target_entity_type = Column(String, nullable=True)   # "person", "vehicle", "location"
    target_entity_id = Column(String, nullable=True, index=True)
    confidence = Column(Integer, nullable=True)           # 0-100
    details = Column(Text, nullable=True)                 # JSON with additional details
    status = Column(String, default=SuggestionStatus.PENDING_REVIEW.value, index=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    evidence = relationship("Evidence", backref="suggestions")
