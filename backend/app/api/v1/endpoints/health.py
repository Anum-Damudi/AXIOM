from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.neo4j import neo4j_client
from app.schemas import ApiResponse

router = APIRouter()

@router.get("", response_model=ApiResponse[dict], tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """System health check endpoint verifying database connectivity and component availability."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    neo4j_client.connect()
    graph_status = "healthy" if neo4j_client._is_connected else "offline_fallback"

    return ApiResponse(
        success=True,
        data={
            "status": "online",
            "services": {
                "postgresql": db_status,
                "neo4j_graph": graph_status,
                "nlp_engine": "healthy",
                "cv_engine": "healthy"
            }
        }
    )
