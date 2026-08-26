"""Constraints and indexes. Run once after Neo4j starts."""

from graph.connection import run_write

CONSTRAINTS = [
    "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT case_id IF NOT EXISTS FOR (n:Case) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT vehicle_id IF NOT EXISTS FOR (n:Vehicle) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (n:Location) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT org_id IF NOT EXISTS FOR (n:Organization) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (n:Event) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT evidence_id IF NOT EXISTS FOR (n:Evidence) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT image_id IF NOT EXISTS FOR (n:Image) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT report_id IF NOT EXISTS FOR (n:Report) REQUIRE n.id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX person_name IF NOT EXISTS FOR (n:Person) ON (n.name)",
    "CREATE INDEX vehicle_plate IF NOT EXISTS FOR (n:Vehicle) ON (n.plate_number)",
    "CREATE INDEX location_name IF NOT EXISTS FOR (n:Location) ON (n.name)",
    "CREATE INDEX case_status IF NOT EXISTS FOR (n:Case) ON (n.status)",
    "CREATE INDEX case_date IF NOT EXISTS FOR (n:Case) ON (n.date)",
    "CREATE INDEX event_date IF NOT EXISTS FOR (n:Event) ON (n.occurred_on)",
    "CREATE INDEX org_name IF NOT EXISTS FOR (n:Organization) ON (n.name)",
]


def apply_schema() -> dict[str, int]:
    for stmt in CONSTRAINTS:
        run_write(stmt)
    for stmt in INDEXES:
        run_write(stmt)
    return {"constraints": len(CONSTRAINTS), "indexes": len(INDEXES)}


if __name__ == "__main__":
    stats = apply_schema()
    print(f"Schema applied: {stats}")
