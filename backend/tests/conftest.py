import os
import shutil

# --- Environment must be configured BEFORE any app import so that settings and
# --- the DB engine are built for the isolated test database (not ./axiom.db).
os.environ["DATABASE_URL"] = "sqlite:///./test_axiom.db"
os.environ["UPLOAD_DIR"] = "./test_uploads"
os.environ["SEED_AUTO_CREATE"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db, engine as shared_engine
from app.db.seed import seed_database

TEST_DB_FILE = "test_axiom.db"
SERVICE_DB_FILE = "test_service_axiom.db"

# Shared engine used by API/endpoint tests (seeded demo dataset lives here).
# Built by app.core.database from the DATABASE_URL env override above.
engine = shared_engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Isolated engine for service-level tests that drop/recreate tables per test.
# Keeping this separate means their table wipes NEVER destroy the shared seed.
service_engine = create_engine(
    f"sqlite:///{SERVICE_DB_FILE}",
    connect_args={"check_same_thread": False}
)
ServiceSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=service_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    for f in (TEST_DB_FILE, SERVICE_DB_FILE):
        if os.path.exists(f):
            os.remove(f)
    shutil.rmtree("./test_uploads", ignore_errors=True)

    # The shared engine is created inside app.core.database; make sure we are
    # actually pointed at the test file before creating tables.
    assert engine.url.database and engine.url.database.endswith(TEST_DB_FILE), engine.url

    Base.metadata.create_all(bind=engine)
    Base.metadata.create_all(bind=service_engine)

    # Ingest the demo seed dataset into the shared test database.
    db = TestingSessionLocal()
    try:
        seed_database(db=db)
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=service_engine)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    service_engine.dispose()
    for f in (TEST_DB_FILE, SERVICE_DB_FILE):
        if os.path.exists(f):
            try:
                os.remove(f)
            except PermissionError:
                pass
    shutil.rmtree("./test_uploads", ignore_errors=True)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def service_db():
    """Fresh, isolated database for service-level tests (droppable per test)."""
    Base.metadata.drop_all(bind=service_engine)
    Base.metadata.create_all(bind=service_engine)
    session = ServiceSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register + login a fresh INVESTIGATOR and return Bearer auth headers."""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    username = f"tester_{suffix}"
    client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@police.gov.in",
        "password": "test_password_123",
        "role": "INVESTIGATOR",
    })
    resp = client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "test_password_123",
    })
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}