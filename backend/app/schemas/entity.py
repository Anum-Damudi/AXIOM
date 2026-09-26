from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class PersonFields(BaseModel):
    role: Optional[str] = "suspect"
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    height: Optional[float] = Field(default=None, ge=0, le=300)
    weight: Optional[float] = Field(default=None, ge=0, le=500)
    occupation: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    aliases: Optional[str] = None
    risk: Optional[str] = "MEDIUM"
    status: Optional[str] = "ACTIVE"


class PersonCreate(PersonFields):
    name: str = Field(min_length=1, max_length=200)


class PersonUpdate(PersonFields):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[str] = None
    risk: Optional[str] = None
    status: Optional[str] = None


class VehicleCreate(BaseModel):
    plate_number: str
    type: Optional[str] = "car"


class LocationCreate(BaseModel):
    name: str


class CaseEntityLinkCreate(BaseModel):
    type: str
    entity_id: Optional[str] = None
    name: Optional[str] = None
    plate_number: Optional[str] = None
    role: Optional[str] = "associate"
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    height: Optional[float] = Field(default=None, ge=0, le=300)
    weight: Optional[float] = Field(default=None, ge=0, le=500)
    occupation: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    aliases: Optional[str] = None
    risk: Optional[str] = "MEDIUM"
    status: Optional[str] = "ACTIVE"


class PersonResponse(PersonFields):
    id: str
    name: str
    normalized_name: Optional[str] = None
    photo_path: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VehicleResponse(BaseModel):
    id: str
    plate_number: str
    type: str

    class Config:
        from_attributes = True


class LocationResponse(BaseModel):
    id: str
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


class PersonConnectionsResponse(BaseModel):
    person: PersonResponse
    direct_connections: List[dict]
    associated_cases: List[dict]
