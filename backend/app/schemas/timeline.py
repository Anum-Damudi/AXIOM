from typing import List, Optional
from pydantic import BaseModel

class TimelineEvent(BaseModel):
    id: str
    timestamp: str
    type: str  # case_created, report_submitted, entity_extracted, evidence_uploaded, relationship_discovered
    description: str
    source: str
    metadata: Optional[dict] = None

class CaseTimelineResponse(BaseModel):
    case_id: str
    events: List[TimelineEvent]
