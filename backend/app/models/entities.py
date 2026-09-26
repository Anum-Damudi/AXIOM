from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime
from app.core.database import Base

class Person(Base):
    __tablename__ = "people"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    age = Column(Integer, nullable=True)
    role = Column(String, default="associate", index=True)
    normalized_name = Column(String, nullable=True, index=True)
    aliases = Column(String, nullable=True)
    photo_path = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    occupation = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    risk = Column(String, default="MEDIUM", index=True)
    status = Column(String, default="ACTIVE", index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String, primary_key=True, index=True)
    plate_number = Column(String, nullable=False, unique=True, index=True)
    type = Column(String, default="car", index=True)  # car, bike, van, truck
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
