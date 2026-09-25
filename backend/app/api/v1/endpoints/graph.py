from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import CytoscapeGraphData, ApiResponse
from app.services import GraphService
from app.core.security import get_current_user
from app.models import User

router = APIRouter()

@router.get("", response_model=ApiResponse[CytoscapeGraphData], tags=["Graph"])
def get_full_graph(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch complete Cytoscape.js formatted knowledge graph (nodes & edges) for interactive network visualization."""
    graph_data = GraphService.get_full_graph(db)
    return ApiResponse(success=True, data=graph_data)
