from typing import Optional, List
from pydantic import BaseModel

class PersonCreate(BaseModel):
    name: str
    role: Optional[str] = "associate"
    age: Optional[int] = None

class VehicleCreate(BaseModel):
    plate_number: str
    type: Optional[str] = "car"

class LocationCreate(BaseModel):
    name: str

class CaseEntityLinkCreate(BaseModel):
    type: str
    name: Optional[str] = None
    plate_number: Optional[str] = None
    role: Optional[str] = "associate"
    age: Optional[int] = None

class PersonResponse(BaseModel):
    id: str
    name: str
    age: Optional[int] = None
    role: str
    normalized_name: Optional[str] = None
    aliases: Optional[str] = None

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
