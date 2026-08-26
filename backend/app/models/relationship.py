from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime
from app.core.database import Base

class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)
    target = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False, index=True)  # MET, CALLED, USED, LOCATED_AT, INVOLVED_IN, TRANSFERRED_MONEY_TO
    date = Column(String, nullable=True, index=True)
    case_id = Column(String, nullable=True, index=True)
    confidence = Column(Float, default=1.0)
    provenance = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
