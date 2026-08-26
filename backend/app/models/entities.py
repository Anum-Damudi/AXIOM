from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime
from app.core.database import Base

class Person(Base):
    __tablename__ = "people"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    age = Column(Integer, nullable=True)
    role = Column(String, default="associate", index=True)  # suspect, witness, associate, victim
    normalized_name = Column(String, nullable=True, index=True)
    aliases = Column(String, nullable=True)  # Comma-separated or JSON string
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
