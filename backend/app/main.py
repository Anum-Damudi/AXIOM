import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.core.neo4j import neo4j_client
from app.core.middleware import setup_exception_handlers
from app.api.v1.api import api_router
from app.schemas import ApiResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("axiom.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AXIOM Backend Engine...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized.")
    neo4j_client.connect()
    yield
    logger.info("Shutting down AXIOM Backend Engine...")
    neo4j_client.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="AI-Powered Criminal Network Analysis & Investigation Intelligence Platform Backend API.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Setup standard exception handlers
setup_exception_handlers(app)

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", response_model=ApiResponse[dict], tags=["Health"])
def root_health():
    """Root health endpoint."""
    return ApiResponse(success=True, data={"status": "online", "app": settings.PROJECT_NAME})
