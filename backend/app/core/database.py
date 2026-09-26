from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import event
from app.core.config import settings

db_url = settings.DATABASE_URL
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_column_sql(dialect: str, table: str, column: str, col_type: str) -> str:
    """Return dialect-appropriate ALTER TABLE ADD COLUMN statement."""
    return f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"


def migrate_schema(engine):
    """Ensure the database schema is up-to-date, dialect-agnostic (SQLite + PostgreSQL)."""
    dialect = engine.dialect.name
    inspector = inspect(engine)

    try:
        with engine.begin() as conn:
            tables = inspector.get_table_names()

            def add_columns(table: str, cols: list):
                if table not in tables:
                    return
                existing = {c["name"] for c in inspector.get_columns(table)}
                for col, col_type in cols:
                    if col not in existing:
                        stmt = _add_column_sql(dialect, table, col, col_type)
                        conn.execute(text(stmt))

            # users table
            add_columns("users", [
                ("role", "VARCHAR(50) DEFAULT 'INVESTIGATOR'"),
                ("is_active", "BOOLEAN DEFAULT TRUE"),
                ("updated_at", "TIMESTAMP"),
            ])

            # people table
            add_columns("people", [
                ("aliases", "TEXT"),
                ("photo_path", "TEXT"),
                ("gender", "VARCHAR(50)"),
                ("height", "FLOAT"),
                ("weight", "FLOAT"),
                ("occupation", "VARCHAR(255)"),
                ("nationality", "VARCHAR(255)"),
                ("address", "TEXT"),
                ("phone", "VARCHAR(50)"),
                ("email", "VARCHAR(255)"),
                ("notes", "TEXT"),
                ("risk", "VARCHAR(50) DEFAULT 'MEDIUM'"),
                ("status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
            ])

            # Evidence table columns
            add_columns("evidence", [
                ("evidence_type", "VARCHAR(255)"),
                ("description", "TEXT"),
                ("date", "TEXT"),
                ("source", "TEXT"),
                ("status", "TEXT DEFAULT 'Pending'"),
                ("related_entity_id", "TEXT"),
                ("sha256", "TEXT"),
                ("perceptual_hash", "TEXT"),
                ("thumbnail_path", "TEXT"),
                ("exif_data", "TEXT"),
                ("current_custodian", "TEXT"),
            ])

            # CDR imports table columns
            add_columns("cdr_imports", [
                ("valid_records", "INTEGER DEFAULT 0"),
                ("invalid_records", "INTEGER DEFAULT 0"),
                ("duplicate_records", "INTEGER DEFAULT 0"),
            ])

    except Exception as e:
        import logging
        logging.getLogger("axiom.db").warning(f"Schema migration skipped/failed: {e}")


# Enforce foreign keys on SQLite connections (default is OFF in SQLite).
if db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_fk_on(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()