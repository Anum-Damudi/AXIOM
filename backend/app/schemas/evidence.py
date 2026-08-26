import json
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, field_validator

class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    title: Optional[str] = None
    file_name: str
    file_path: str
    mime_type: str
    file_size: int
    uploaded_by: Optional[str] = None
    analysis_status: str
    analysis_result: Optional[Dict[str, Any]] = None

    @field_validator("analysis_result", mode="before")
    def parse_json_string(cls, v: Union[str, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
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
