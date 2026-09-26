import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal, migrate_schema
from app.core.neo4j import neo4j_client
from app.core.middleware import setup_exception_handlers
from app.api.v1.api import api_router
from app.schemas import ApiResponse
from app.services.ledger_service import LedgerService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("axiom.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AXIOM Backend Engine...")
    Base.metadata.create_all(bind=engine)
    migrate_schema(engine)
    logger.info("Database tables initialized and schema verified.")

    # Do not block Render startup waiting for Neo4j.
    logger.info("Skipping Neo4j connection during startup.")

# Create genesis block and default users if none exists
    
    # Create genesis block and default users if none exists
    db = SessionLocal()
    try:
        from app.models import User
        if db.query(User).count() == 0:
            try:
                from app.db.seed import seed_database
                seed_database(db)
                logger.info("Database auto-seeded successfully.")
            except Exception as se:
                logger.error(f"Failed to auto-seed database: {se}")
        else:
            # Idempotently ensure the required demo accounts exist (safe at every startup).
            from app.db.seed import ensure_demo_users
            ensure_demo_users(db)
            logger.info("Demo accounts ensured.")
        LedgerService.create_genesis_block(db)
        logger.info("Ledger genesis block checked/created.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    finally:
        db.close()
    
    # Start background seal timer
    seal_task = asyncio.create_task(seal_ledger_periodically())
    
    yield
    
    # Cancel background task
    seal_task.cancel()
    try:
        await seal_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Shutting down AXIOM Backend Engine...")
    neo4j_client.close()

async def seal_ledger_periodically():
    """Background task to periodically seal ledger blocks."""
    while True:
        try:
            await asyncio.sleep(settings.LEDGER_SEAL_INTERVAL_SECONDS)
            db = SessionLocal()
            try:
                block = LedgerService.seal_block(db, sealed_by="system")
                if block:
                    logger.info(f"Auto-sealed block {block.index}")
            except Exception as e:
                logger.error(f"Auto-seal failed: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Seal timer error: {e}")

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

# Serve uploaded media (evidence files, thumbnails, suspect photos).
# Files are stored under unguessable random IDs; treat as capability URLs — the
# recommended production hardening is signed/temporary URLs tied to authorization.
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", response_model=ApiResponse[dict], tags=["Health"])
def root_health():
    """Root health endpoint verifying database and neo4j connectivity."""
    from sqlalchemy import text
    db_connected = False
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False
    finally:
        db.close()

    neo4j_client.connect()
    neo4j_connected = bool(neo4j_client._is_connected)

    overall_status = "ok" if (db_connected and neo4j_connected) else ("degraded" if db_connected else "down")

    return ApiResponse(
        success=db_connected,
        data={
            "status": overall_status,
            "database": "connected" if db_connected else "disconnected",
            "neo4j": "connected" if neo4j_connected else "disconnected",
            "app": settings.PROJECT_NAME
        }
    )
