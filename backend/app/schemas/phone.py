from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class PhoneNumberResponse(BaseModel):
    id: str
    number: str
    normalized: str
    country_code: Optional[str] = None
    is_active: bool
    first_seen: datetime
    last_seen: datetime
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PersonPhoneResponse(BaseModel):
    id: str
    person_id: str
    phone_id: str
    relationship_type: Optional[str] = None
    is_primary: bool
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CellTowerResponse(BaseModel):
    id: str
    tower_id: str
    operator: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    coverage_radius_meters: Optional[float] = None
    technology: Optional[str] = None
    sector_count: int
    address: Optional[str] = None
    region: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CallRecordResponse(BaseModel):
    id: str
    cdr_import_id: str
    caller_number: str
    caller_normalized: str
    called_number: str
    called_normalized: str
    call_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    tower_id: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    imsi: Optional[str] = None
    imei: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CDRImportResponse(BaseModel):
    id: str
    case_id: str
    source_file: str
    source_type: str
    operator: Optional[str] = None
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    total_records: int
    valid_records: Optional[int] = 0
    invalid_records: Optional[int] = 0
    duplicate_records: Optional[int] = 0
    imported_by: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CDRImportRequest(BaseModel):
    case_id: str = Field(..., description="Case ID to associate CDR with")
    source_type: str = Field(..., description="File type: csv, excel, json")
    operator: Optional[str] = Field(None, description="Mobile operator name")

class PhoneProfileResponse(BaseModel):
    phone: PhoneNumberResponse
    associated_people: List[PersonPhoneResponse] = []
    total_calls: int = 0
    unique_contacts: int = 0
    first_call: Optional[datetime] = None
    last_call: Optional[datetime] = None
    top_contacts: List[Dict[str, Any]] = []
    call_pattern: Dict[str, Any] = {}

class MovementAnalysisResponse(BaseModel):
    phone_number: str
    locations: List[Dict[str, Any]] = []
    total_locations: int = 0
    date_range: Dict[str, datetime] = {}
    frequent_locations: List[Dict[str, Any]] = []

class NetworkAnalysisResponse(BaseModel):
    phone_number: str
    total_contacts: int = 0
    contacts: List[Dict[str, Any]] = []
    call_frequency: Dict[str, int] = {}
    peak_hours: List[int] = []

class ColocationAnalysisResponse(BaseModel):
    phone_numbers: List[str]
    colocations: List[Dict[str, Any]] = []
    total_colocations: int = 0

class BurnerDetectionResponse(BaseModel):
    phone_number: str
    is_burner: bool
    confidence: float
    indicators: List[str] = []
    details: Dict[str, Any] = {}
