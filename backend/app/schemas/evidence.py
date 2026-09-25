import json
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from pydantic import BaseModel, field_validator, Field


class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    title: Optional[str] = None
    evidence_type: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = "Pending"
    related_entity_id: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_by: Optional[str] = None
    analysis_status: str = "PENDING"
    analysis_result: Optional[Dict[str, Any]] = None
    sha256: Optional[str] = None
    perceptual_hash: Optional[str] = None
    thumbnail_path: Optional[str] = None
    exif_data: Optional[Dict[str, Any]] = None
    current_custodian: Optional[str] = None
    created_at: datetime

    @field_validator("analysis_result", mode="before")
    def parse_json_string(cls, v: Union[str, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    @field_validator("exif_data", mode="before")
    def parse_exif_json(cls, v: Union[str, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True


class CvAnalysisResult(BaseModel):
    objects: List[str] = []
    text: List[str] = []
    confidence: List[float] = []
    processing_status: str = "completed"


class BatchFileResult(BaseModel):
    success: bool
    evidence_id: Optional[str] = None
    file_name: str
    error: Optional[str] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None


class BatchUploadResponse(BaseModel):
    case_id: str
    total_files: int
    successful: int
    failed: int
    duplicates: int
    results: List[BatchFileResult]


class EvidenceSuggestionResponse(BaseModel):
    id: str
    evidence_id: str
    suggestion_type: str
    target_entity_type: Optional[str] = None
    target_entity_id: Optional[str] = None
    confidence: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("details", mode="before")
    def parse_details_json(cls, v: Union[str, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True


class SuggestionActionRequest(BaseModel):
    action: str  # "confirm" or "reject"
    reason: Optional[str] = None


class EvidenceDownloadRequest(BaseModel):
    purpose: str = Field(..., description="Purpose for downloading evidence (for audit)")


class EvidenceDetailResponse(EvidenceResponse):
    suggestions: List[EvidenceSuggestionResponse] = []
    custody_timeline: List[Dict[str, Any]] = []
