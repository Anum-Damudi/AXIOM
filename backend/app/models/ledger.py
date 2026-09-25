from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class EntryType(str, Enum):
    EVIDENCE_REGISTERED = "EVIDENCE_REGISTERED"
    CUSTODY_TRANSFER = "CUSTODY_TRANSFER"
    ACCESSED = "ACCESSED"
    ANALYSIS_RUN = "ANALYSIS_RUN"
    REPORT_FILED = "REPORT_FILED"

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String, primary_key=True, index=True)
    entry_type = Column(String, nullable=False, index=True)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_id = Column(String, nullable=False)
    payload = Column(Text, nullable=False)
    payload_hash = Column(String, nullable=False, index=True)
    block_id = Column(Integer, ForeignKey("ledger_blocks.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    block = relationship("LedgerBlock", back_populates="entries")

class LedgerBlock(Base):
    __tablename__ = "ledger_blocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer, unique=True, nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    prev_hash = Column(String, nullable=False)
    merkle_root = Column(String, nullable=False)
    block_hash = Column(String, nullable=False, unique=True, index=True)
    sealed_by = Column(String, nullable=False)
    anchor_tx = Column(String, nullable=True)

    entries = relationship("LedgerEntry", back_populates="block")

class CustodyTransfer(Base):
    __tablename__ = "custody_transfers"

    id = Column(String, primary_key=True, index=True)
    evidence_id = Column(String, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    from_user_id = Column(String, nullable=False)
    to_user_id = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    transferred_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
