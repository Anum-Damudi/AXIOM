from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class GraphNode(BaseModel):
    id: str
    label: str
    name: str
    type: str
    metadata: Optional[Dict[str, Any]] = None

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    metadata: Optional[Dict[str, Any]] = None

class CytoscapeGraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
