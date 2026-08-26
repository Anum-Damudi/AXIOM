from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class ReportCreate(BaseModel):
    report_text: str

class ExtractedEntityPerson(BaseModel):
    id: Optional[str] = None
    name: str
    age: Optional[int] = None
    role: Optional[str] = "associate"

class ExtractedEntityVehicle(BaseModel):
    id: Optional[str] = None
    plate_number: str
    type: Optional[str] = "car"

class ExtractedEntityLocation(BaseModel):
    id: Optional[str] = None
    name: str

class ExtractedRelationship(BaseModel):
    source: str
    relationship: str
    target: str
    confidence: float = 0.90
    date: Optional[str] = None

class ExtractedNlpResult(BaseModel):
    entities: Dict[str, List[Any]]  # people, vehicles, locations, dates
    relationships: List[ExtractedRelationship]

class ReportResponse(BaseModel):
    id: str
    case_id: str
    report_text: str
    processing_status: str
    nlp_output: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
