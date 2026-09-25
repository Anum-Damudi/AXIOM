import os
import json
import uuid
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.core.config import settings
from app.core.neo4j import neo4j_client
from app.models import User, Case, CaseReport, Person, Vehicle, Location, Relationship, Evidence, AuditLog, PhoneNumber, PersonPhone, CellTower, CallRecord, CDRImport, LedgerBlock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("axiom.seed")

def find_data_dir() -> str:
    # Try finding data/ directory relative to project root or current working dir
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"),
        os.path.join(os.getcwd(), "data"),
        os.path.join(os.getcwd(), "..", "data"),
        "C:\\Users\\anumd\\Desktop\\AXIOM\\AXIOM\\data"
    ]
    for path in possible_paths:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path) and os.path.isdir(abs_path):
            return abs_path
    raise FileNotFoundError("Could not locate /data directory containing synthetic JSON files.")

def load_json(data_dir: str, filename: str):
    file_path = os.path.join(data_dir, filename)
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def ensure_demo_users(db: Session) -> None:
    """Idempotently create/update the three required demo accounts (env-configurable, hashed).

    Safe to call on every startup: never clobbers a user who already uses the configured
    email (so password changes persist), but migrates legacy seed credentials forward.
    """
    if not getattr(settings, "SEED_AUTO_CREATE", True):
        return

    demo_accounts = [
        {
            "username": settings.SEED_ADMIN_USERNAME,
            "email": settings.SEED_ADMIN_EMAIL,
            "password": settings.SEED_ADMIN_PASSWORD,
            "role": "ADMIN",
        },
        {
            "username": settings.SEED_INVESTIGATOR_USERNAME,
            "email": settings.SEED_INVESTIGATOR_EMAIL,
            "password": settings.SEED_INVESTIGATOR_PASSWORD,
            "role": "INVESTIGATOR",
        },
        {
            "username": settings.SEED_OFFICER_USERNAME,
            "email": settings.SEED_OFFICER_EMAIL,
            "password": settings.SEED_OFFICER_PASSWORD,
            "role": "OFFICER",
        },
    ]
    # Legacy demo addresses that are safe to migrate to the current seed credentials.
    legacy_emails = {
        "admin": "admin@axiom.police.gov.in",
        "investigator": "investigator@axiom.police.gov.in",
    }

    for acc in demo_accounts:
        user = db.query(User).filter(User.username == acc["username"]).first()
        if user:
            # Idempotency guard: never clobber an already-configured account unless it is
            # still using legacy seed credentials (migration path).
            if user.email != acc["email"] and user.email in (legacy_emails.get(acc["username"]), None):
                user.email = acc["email"]
                user.hashed_password = get_password_hash(acc["password"])
                user.role = acc["role"]
                logger.info(f"Migrated legacy seed user '{acc['username']}' to {acc['email']}")
        else:
            # Also skip creating if another user already holds this email (defensive).
            email_owner = db.query(User).filter(User.email == acc["email"]).first()
            if email_owner:
                logger.warning(f"Skipping seed of {acc['email']}: email already used by another account.")
                continue
            logger.info(f"Seeding demo {acc['role']} account: {acc['email']}")
            fixed_ids = {"ADMIN": "U001", "INVESTIGATOR": "U002", "OFFICER": "U003"}
            candidate_id = fixed_ids.get(acc["role"])
            if candidate_id and db.query(User).filter(User.id == candidate_id).first():
                candidate_id = f"U{uuid.uuid4().hex[:6].upper()}"
            db.add(User(
                id=candidate_id or f"U{uuid.uuid4().hex[:6].upper()}",
                username=acc["username"],
                email=acc["email"],
                hashed_password=get_password_hash(acc["password"]),
                role=acc["role"]
            ))
    db.commit()


def seed_database(db: Session = None):
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        data_dir = find_data_dir()
        logger.info(f"Loading seed data from: {data_dir}")

        # 1. Seed Users (idempotent, env-driven demo accounts, hashed passwords)
        ensure_demo_users(db)

        # 2. Seed People
        people_data = load_json(data_dir, "people.json")
        for p in people_data:
            if not db.query(Person).filter(Person.id == p["id"]).first():
                db.add(Person(
                    id=p["id"],
                    name=p["name"],
                    age=p.get("age"),
                    role=p.get("role", "associate"),
                    normalized_name=p["name"].lower()
                ))

        # 3. Seed Vehicles
        vehicles_data = load_json(data_dir, "vehicles.json")
        for v in vehicles_data:
            if not db.query(Vehicle).filter(Vehicle.id == v["id"]).first():
                db.add(Vehicle(
                    id=v["id"],
                    plate_number=v["plate_number"],
                    type=v.get("type", "car")
                ))

        # 4. Seed Locations
        locations_data = load_json(data_dir, "locations.json")
        for l in locations_data:
            if not db.query(Location).filter(Location.id == l["id"]).first():
                db.add(Location(
                    id=l["id"],
                    name=l["name"],
                    lat=l.get("lat"),
                    lng=l.get("lng")
                ))

        # 5. Seed Cases
        cases_data = load_json(data_dir, "cases.json")
        for c in cases_data:
            if not db.query(Case).filter(Case.id == c["id"]).first():
                db.add(Case(
                    id=c["id"],
                    title=c["title"],
                    date=c["date"],
                    status=c.get("status", "open"),
                    priority="high" if "1" in c["id"] or "2" in c["id"] else "medium",
                    case_type="Criminal Investigation",
                    investigating_officer="Officer Inspector R. Sharma"
                ))

        # 6. Seed Relationships
        relationships_data = load_json(data_dir, "relationships.json")
        for r in relationships_data:
            if not db.query(Relationship).filter(Relationship.id == r["id"]).first():
                db.add(Relationship(
                    id=r["id"],
                    source=r["source"],
                    target=r["target"],
                    type=r["type"],
                    date=r.get("date"),
                    confidence=1.0,
                    provenance="Synthetic Investigation Dataset"
                ))

        # 7. Seed Case Reports
        reports_data = load_json(data_dir, "case_reports.json")
        for idx, rep in enumerate(reports_data, start=1):
            rep_id = f"REP{idx:03d}"
            if not db.query(CaseReport).filter(CaseReport.id == rep_id).first():
                db.add(CaseReport(
                    id=rep_id,
                    case_id=rep["case_id"],
                    report_text=rep["report_text"],
                    processing_status="COMPLETED"
                ))

        # 8. Seed Phone Numbers
        if os.path.exists(os.path.join(data_dir, "phones.json")):
            phones_data = load_json(data_dir, "phones.json")
            for p in phones_data:
                if not db.query(PhoneNumber).filter(PhoneNumber.id == p["id"]).first():
                    from datetime import datetime
                    db.add(PhoneNumber(
                        id=p["id"],
                        number=p["number"],
                        normalized=p["normalized"],
                        country_code=p.get("country_code"),
                        is_active=p.get("is_active", True),
                        notes=p.get("notes"),
                        first_seen=datetime.fromisoformat(p["first_seen"].replace("Z", "+00:00")) if p.get("first_seen") else None,
                        last_seen=datetime.fromisoformat(p["last_seen"].replace("Z", "+00:00")) if p.get("last_seen") else None
                    ))

        # 9. Seed Cell Towers
        if os.path.exists(os.path.join(data_dir, "towers.json")):
            towers_data = load_json(data_dir, "towers.json")
            for t in towers_data:
                if not db.query(CellTower).filter(CellTower.id == t["id"]).first():
                    from datetime import datetime
                    db.add(CellTower(
                        id=t["id"],
                        tower_id=t["tower_id"],
                        operator=t.get("operator"),
                        latitude=t.get("latitude"),
                        longitude=t.get("longitude"),
                        altitude=t.get("altitude"),
                        coverage_radius_meters=t.get("coverage_radius_meters"),
                        technology=t.get("technology"),
                        sector_count=t.get("sector_count", 3),
                        address=t.get("address"),
                        region=t.get("region"),
                        created_at=datetime.fromisoformat(t.get("created_at", "2024-01-01T00:00:00Z").replace("Z", "+00:00"))
                    ))

        # 10. Seed Person-Phone Associations
        if os.path.exists(os.path.join(data_dir, "person_phones.json")):
            person_phones_data = load_json(data_dir, "person_phones.json")
            for pp in person_phones_data:
                if not db.query(PersonPhone).filter(PersonPhone.id == pp["id"]).first():
                    from datetime import datetime
                    db.add(PersonPhone(
                        id=pp["id"],
                        person_id=pp["person_id"],
                        phone_id=pp["phone_id"],
                        relationship_type=pp.get("relationship_type"),
                        is_primary=pp.get("is_primary", False),
                        start_date=datetime.fromisoformat(pp["start_date"].replace("Z", "+00:00")) if pp.get("start_date") else None,
                        end_date=datetime.fromisoformat(pp["end_date"].replace("Z", "+00:00")) if pp.get("end_date") else None,
                        notes=pp.get("notes")
                    ))

        # 11. Seed CDR Import and Call Records
        if os.path.exists(os.path.join(data_dir, "call_records.json")):
            call_records_data = load_json(data_dir, "call_records.json")
            # Create a CDR import for the call records
            cdr_import_id = "CDR-001"
            if not db.query(CDRImport).filter(CDRImport.id == cdr_import_id).first():
                from datetime import datetime
                cdr_import = CDRImport(
                    id=cdr_import_id,
                    case_id="C001",
                    source_file="synthetic_cdr.csv",
                    source_type="csv",
                    operator="JIO",
                    date_range_start=datetime.fromisoformat("2024-01-15T00:00:00Z"),
                    date_range_end=datetime.fromisoformat("2024-03-01T23:59:59Z"),
                    total_records=len(call_records_data),
                    imported_by="system",
                    status="COMPLETED"
                )
                db.add(cdr_import)
            
            # Seed call records
            for cr in call_records_data:
                if not db.query(CallRecord).filter(CallRecord.id == cr["id"]).first():
                    from datetime import datetime
                    db.add(CallRecord(
                        id=cr["id"],
                        cdr_import_id=cr["cdr_import_id"],
                        caller_number=cr["caller_number"],
                        caller_normalized=cr["caller_normalized"],
                        called_number=cr["called_number"],
                        called_normalized=cr["called_normalized"],
                        call_type=cr["call_type"],
                        start_time=datetime.fromisoformat(cr["start_time"].replace("Z", "+00:00")),
                        end_time=datetime.fromisoformat(cr["end_time"].replace("Z", "+00:00")) if cr.get("end_time") else None,
                        duration_seconds=cr.get("duration_seconds"),
                        tower_id=cr.get("tower_id"),
                        location_lat=cr.get("location_lat"),
                        location_lon=cr.get("location_lon"),
                        imsi=cr.get("imsi"),
                        imei=cr.get("imei")
                    ))

        # 12. Create Genesis Ledger Block
        if db.query(LedgerBlock).count() == 0:
            from app.services.ledger_service import LedgerService
            logger.info("Creating genesis ledger block...")
            genesis_block = LedgerService.create_genesis_block(db)
            logger.info(f"Genesis block created: {genesis_block.id}")

        db.commit()
        logger.info("PostgreSQL/SQLite database seeding complete!")

        # 13. Seed Neo4j Knowledge Graph (If Neo4j is available)
        seed_neo4j_graph(people_data, vehicles_data, locations_data, cases_data, relationships_data)

    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}", exc_info=True)
    finally:
        db.close()

def seed_neo4j_graph(people, vehicles, locations, cases, relationships):
    neo4j_client.connect()
    if not neo4j_client._is_connected:
        logger.warning("Neo4j database not reachable. Skipping Neo4j direct graph insertion.")
        return

    logger.info("Syncing seed dataset into Neo4j Knowledge Graph...")
    try:
        # Clear existing nodes & edges for fresh idempotent seed
        neo4j_client.execute_query("MATCH (n) DETACH DELETE n")

        # Create People
        for p in people:
            query = "CREATE (:Person {id: $id, name: $name, age: $age, role: $role})"
            neo4j_client.execute_query(query, p)

        # Create Vehicles
        for v in vehicles:
            query = "CREATE (:Vehicle {id: $id, plate_number: $plate_number, type: $type})"
            neo4j_client.execute_query(query, v)

        # Create Locations
        for l in locations:
            query = "CREATE (:Location {id: $id, name: $name, lat: $lat, lng: $lng})"
            neo4j_client.execute_query(query, l)

        # Create Cases
        for c in cases:
            query = "CREATE (:Case {id: $id, title: $title, date: $date, status: $status})"
            neo4j_client.execute_query(query, c)

        # Create Relationships
        for r in relationships:
            import re as _re
            rel_type = _re.sub(r"[^A-Z0-9_]+", "_", str(r["type"]).upper()).strip("_") or "RELATED"
            query = (
                "MATCH (s {id: $source}), (t {id: $target}) "
                f"CREATE (s)-[:{rel_type} {{id: $id, date: $date}}]->(t)"
            )
            neo4j_client.execute_query(query, r)

        # Create Phones
        if os.path.exists(os.path.join(find_data_dir(), "phones.json")):
            phones_data = load_json(find_data_dir(), "phones.json")
            for p in phones_data:
                query = "MERGE (ph:Phone {id: $id}) SET ph.number = $number, ph.normalized = $normalized, ph.is_active = $is_active"
                neo4j_client.execute_query(query, p)

        # Create Phone-Person relationships
        if os.path.exists(os.path.join(find_data_dir(), "person_phones.json")):
            person_phones_data = load_json(find_data_dir(), "person_phones.json")
            for pp in person_phones_data:
                query = """
                MATCH (p:Person {id: $person_id}), (ph:Phone {id: $phone_id})
                MERGE (p)-[r:HAS_PHONE]->(ph)
                SET r.relationship_type = $relationship_type, r.is_primary = $is_primary
                """
                neo4j_client.execute_query(query, pp)

        logger.info("Neo4j graph sync complete!")
    except Exception as e:
        logger.error(f"Error syncing Neo4j graph: {e}")

if __name__ == "__main__":
    seed_database()
