from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class NetworkMetricResult(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str
    metric: str  # degree_centrality, betweenness_centrality
    score: float
    interpretation: str
    evidence: List[str] = []

class CommunityClusterResult(BaseModel):
    community_id: int
    size: int
    members: List[Dict[str, Any]]
    description: str

class HiddenLinkResult(BaseModel):
    source_entity: Dict[str, Any]
    target_entity: Dict[str, Any]
    path_length: int
    intermediate_nodes: List[Dict[str, Any]]
    confidence: float
    explanation: str
