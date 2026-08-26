import os
import json
import logging
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.core.neo4j import neo4j_client
from app.models import User, Case, CaseReport, Person, Vehicle, Location, Relationship, Evidence, AuditLog

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

        # 1. Seed Users
        if db.query(User).count() == 0:
            logger.info("Seeding Users...")
            admin_user = User(
                id="U001",
                username="admin",
                email="admin@axiom.police.gov.in",
                hashed_password=get_password_hash("admin123"),
                role="ADMIN"
            )
            investigator_user = User(
                id="U002",
                username="investigator",
                email="investigator@axiom.police.gov.in",
                hashed_password=get_password_hash("investigator123"),
                role="INVESTIGATOR"
            )
            db.add_all([admin_user, investigator_user])
            db.commit()

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

        db.commit()
        logger.info("PostgreSQL/SQLite database seeding complete!")

        # 8. Seed Neo4j Knowledge Graph (If Neo4j is available)
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
            rel_type = r["type"].upper().replace(" ", "_")
            query = (
                "MATCH (s {id: $source}), (t {id: $target}) "
                f"CREATE (s)-[:{rel_type} {{id: $id, date: $date}}]->(t)"
            )
            neo4j_client.execute_query(query, r)

        logger.info("Neo4j graph sync complete!")
    except Exception as e:
        logger.error(f"Error syncing Neo4j graph: {e}")

if __name__ == "__main__":
    seed_database()
