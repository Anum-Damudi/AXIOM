from typing import List, Dict, Any
from pydantic import BaseModel

class DashboardSummary(BaseModel):
    total_cases: int
    active_cases: int
    closed_cases: int
    high_priority_cases: int
    total_people: int
    total_vehicles: int
    total_locations: int
    total_relationships: int
    evidence_count: int

class DashboardRecentActivity(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str
    details: str
    timestamp: str

class NetworkSummary(BaseModel):
    total_nodes: int
    total_edges: int
    key_central_persons: List[Dict[str, Any]]
    active_clusters_count: int
