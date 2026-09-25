from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class PhoneNumber(Base):
    __tablename__ = "phone_numbers"

    id = Column(String, primary_key=True, index=True)
    number = Column(String, nullable=False, index=True)
    normalized = Column(String, nullable=False, index=True)  # E.164 format
    country_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    first_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PersonPhone(Base):
    __tablename__ = "person_phones"

    id = Column(String, primary_key=True, index=True)
    person_id = Column(String, ForeignKey("people.id", ondelete="CASCADE"), nullable=False, index=True)
    phone_id = Column(String, ForeignKey("phone_numbers.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(String, nullable=True)  # "primary", "secondary", "work", etc.
    is_primary = Column(Boolean, default=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    person = relationship("Person", backref="phone_associations")
    phone = relationship("PhoneNumber", backref="person_associations")


class CellTower(Base):
    __tablename__ = "cell_towers"

    id = Column(String, primary_key=True, index=True)
    tower_id = Column(String, nullable=False, index=True)  # Operator's tower ID
    operator = Column(String, nullable=True)  # "JIO", "Airtel", "Vodafone", etc.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    altitude = Column(Float, nullable=True)
    coverage_radius_meters = Column(Float, nullable=True)
    technology = Column(String, nullable=True)  # "2G", "3G", "4G", "5G"
    sector_count = Column(Integer, default=3)
    address = Column(String, nullable=True)
    region = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(String, primary_key=True, index=True)
    cdr_import_id = Column(String, ForeignKey("cdr_imports.id", ondelete="CASCADE"), nullable=False, index=True)
    caller_number = Column(String, nullable=False, index=True)
    caller_normalized = Column(String, nullable=False, index=True)
    called_number = Column(String, nullable=False, index=True)
    called_normalized = Column(String, nullable=False, index=True)
    call_type = Column(String, nullable=False)  # "incoming", "outgoing", "missed"
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    tower_id = Column(String, ForeignKey("cell_towers.id"), nullable=True, index=True)
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    imsi = Column(String, nullable=True)  # International Mobile Subscriber Identity
    imei = Column(String, nullable=True)  # International Mobile Equipment Identity
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    cdr_import = relationship("CDRImport", backref="call_records")
    tower = relationship("CellTower", backref="call_records")


class CDRImport(Base):
    __tablename__ = "cdr_imports"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    source_file = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # "csv", "excel", "json"
    operator = Column(String, nullable=True)
    date_range_start = Column(DateTime, nullable=True)
    date_range_end = Column(DateTime, nullable=True)
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    imported_by = Column(String, nullable=True)
    status = Column(String, default="PROCESSING", index=True)  # PROCESSING, COMPLETED, FAILED
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    case = relationship("Case", backref="cdr_imports")
