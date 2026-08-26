from typing import Optional, List
from pydantic import BaseModel

class CaseCreate(BaseModel):
    title: str
    date: str
    status: Optional[str] = "open"
    priority: Optional[str] = "medium"
    case_type: Optional[str] = "Criminal Investigation"
    investigating_officer: Optional[str] = None

class CaseUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    case_type: Optional[str] = None
    investigating_officer: Optional[str] = None

class CaseResponse(BaseModel):
    id: str
    title: str
    date: str
    status: str
    priority: str
    case_type: Optional[str] = "general"
    investigating_officer: Optional[str] = None

    class Config:
        from_attributes = True

class RelatedCaseConnection(BaseModel):
    case_id: str
    title: Optional[str] = None
    connection_type: str  # shared_person, shared_vehicle, shared_location
    entity_id: str
    entity_name: str
    confidence: float = 1.0
    provenance: str
