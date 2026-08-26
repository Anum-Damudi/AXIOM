import re
import json
import uuid
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models import Case, CaseReport, Person, Vehicle, Location, Relationship
from app.services.graph_service import GraphService
from app.services.audit_service import AuditService

logger = logging.getLogger("axiom.nlp")

class NlpService:
    @staticmethod
    def process_case_report(db: Session, report_id: str) -> CaseReport:
        report = db.query(CaseReport).filter(CaseReport.id == report_id).first()
        if not report:
            raise ValueError(f"Report {report_id} not found")

        report.processing_status = "PROCESSING"
        db.commit()

        try:
            # 1. Run NLP Extraction pipeline
            extracted_data = NlpService._extract_entities_and_relationships(report.report_text)
            
            # 2. Untrusted Input Validation & Normalization
            validated_payload = NlpService._validate_and_normalize(extracted_data)

            # 3. Persist Entities & Relationships into PostgreSQL
            NlpService._persist_nlp_results(db, report.case_id, validated_payload)

            # 4. Update Report Status & Output
            report.processing_status = "COMPLETED"
            report.nlp_output = json.dumps(validated_payload)
            db.commit()

            AuditService.log_action(
                db,
                action="NLP_REPORT_PROCESSED",
                resource_type="report",
                resource_id=report.id,
                details={"case_id": report.case_id, "entities_found": len(validated_payload.get("people", []))}
            )

            return report

        except Exception as e:
            logger.error(f"NLP processing failed for report {report_id}: {e}", exc_info=True)
            report.processing_status = "FAILED"
            db.commit()
            raise e

    @staticmethod
    def _extract_entities_and_relationships(text: str) -> Dict[str, Any]:
        """
        AI NLP Service Adapter.
        Extracts people, vehicles, locations, dates, and relationships from text narrative.
        """
        people = []
        vehicles = []
        locations = []
        dates = []
        relationships = []

        # Vehicle extraction regex (e.g. KA-56-ED-1949)
        veh_matches = re.findall(r'[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}', text)
        for plate in set(veh_matches):
            vehicles.append({"plate_number": plate, "type": "car"})

        # Date extraction regex (e.g. 2026-03-20)
        date_matches = re.findall(r'\b\d{4}-\d{2}-\d{2}\b', text)
        dates.extend(list(set(date_matches)))
        rel_date = dates[0] if dates else "2026-01-01"

        # Pattern: "Name1 met Name2 near Location on Date using vehicle Plate"
        met_pattern = re.search(r'([A-Z][a-z]+ [A-Z][a-z]+)\s+met\s+([A-Z][a-z]+ [A-Z][a-z]+)(?:\s+near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))?', text)
        if met_pattern:
            p1_name = met_pattern.group(1).strip()
            p2_name = met_pattern.group(2).strip()
            loc_name = met_pattern.group(3).strip() if met_pattern.group(3) else None

            people.append({"name": p1_name, "role": "suspect"})
            people.append({"name": p2_name, "role": "associate"})

            if loc_name:
                locations.append({"name": loc_name})
                relationships.append({
                    "source": p1_name,
                    "relationship": "LOCATED_AT",
                    "target": loc_name,
                    "confidence": 0.92,
                    "date": rel_date
                })

            relationships.append({
                "source": p1_name,
                "relationship": "MET",
                "target": p2_name,
                "confidence": 0.95,
                "date": rel_date
            })

            if veh_matches:
                relationships.append({
                    "source": p1_name,
                    "relationship": "USED",
                    "target": veh_matches[0],
                    "confidence": 0.91,
                    "date": rel_date
                })

        return {
            "people": people,
            "vehicles": vehicles,
            "locations": locations,
            "dates": dates,
            "relationships": relationships
        }

    @staticmethod
    def _validate_and_normalize(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validates AI extraction outputs to ensure missing/null/corrupt data doesn't break system."""
        validated = {
            "people": [],
            "vehicles": [],
            "locations": [],
            "dates": payload.get("dates", []),
            "relationships": []
        }

        for p in payload.get("people", []):
            if isinstance(p, dict) and p.get("name"):
                validated["people"].append({
                    "name": str(p["name"]).strip(),
                    "role": str(p.get("role", "associate")).lower(),
                    "age": int(p["age"]) if p.get("age") and str(p["age"]).isdigit() else None
                })

        for v in payload.get("vehicles", []):
            if isinstance(v, dict) and v.get("plate_number"):
                validated["vehicles"].append({
                    "plate_number": str(v["plate_number"]).strip().upper(),
                    "type": str(v.get("type", "car")).lower()
                })

        for l in payload.get("locations", []):
            if isinstance(l, dict) and l.get("name"):
                validated["locations"].append({
                    "name": str(l["name"]).strip()
                })

        for r in payload.get("relationships", []):
            if isinstance(r, dict) and r.get("source") and r.get("target") and r.get("relationship"):
                validated["relationships"].append({
                    "source": str(r["source"]).strip(),
                    "relationship": str(r["relationship"]).strip().upper(),
                    "target": str(r["target"]).strip(),
                    "confidence": float(r.get("confidence", 0.90)),
                    "date": r.get("date")
                })

        return validated

    @staticmethod
    def _persist_nlp_results(db: Session, case_id: str, payload: Dict[str, Any]):
        name_to_id = {}

        # 1. Resolve/Insert People
        for p in payload["people"]:
            existing = db.query(Person).filter(Person.name == p["name"]).first()
            if existing:
                name_to_id[p["name"]] = existing.id
            else:
                new_id = f"P{uuid.uuid4().hex[:6].upper()}"
                person_obj = Person(
                    id=new_id,
                    name=p["name"],
                    age=p.get("age"),
                    role=p.get("role", "associate"),
                    normalized_name=p["name"].lower()
                )
                db.add(person_obj)
                name_to_id[p["name"]] = new_id

        # 2. Resolve/Insert Vehicles
        for v in payload["vehicles"]:
            existing = db.query(Vehicle).filter(Vehicle.plate_number == v["plate_number"]).first()
            if existing:
                name_to_id[v["plate_number"]] = existing.id
            else:
                new_id = f"V{uuid.uuid4().hex[:6].upper()}"
                veh_obj = Vehicle(
                    id=new_id,
                    plate_number=v["plate_number"],
                    type=v.get("type", "car")
                )
                db.add(veh_obj)
                name_to_id[v["plate_number"]] = new_id

        # 3. Resolve/Insert Locations
        for l in payload["locations"]:
            existing = db.query(Location).filter(Location.name == l["name"]).first()
            if existing:
                name_to_id[l["name"]] = existing.id
            else:
                new_id = f"L{uuid.uuid4().hex[:6].upper()}"
                loc_obj = Location(
                    id=new_id,
                    name=l["name"]
                )
                db.add(loc_obj)
                name_to_id[l["name"]] = new_id

        db.commit()

        # 4. Connect Entities to Case via INVOLVED_IN Relationships
        for entity_name, entity_id in name_to_id.items():
            rel_id = f"R{uuid.uuid4().hex[:6].upper()}"
            existing_rel = db.query(Relationship).filter(
                Relationship.source == entity_id,
                Relationship.target == case_id,
                Relationship.type == "INVOLVED_IN"
            ).first()
            if not existing_rel:
                rel = Relationship(
                    id=rel_id,
                    source=entity_id,
                    target=case_id,
                    type="INVOLVED_IN",
                    confidence=0.95,
                    provenance=f"Extracted from Case Report for {case_id}"
                )
                db.add(rel)
                GraphService.sync_relationship_to_graph(rel_id, entity_id, case_id, "INVOLVED_IN")

        # 5. Insert Extracted Entity-to-Entity Relationships
        for r in payload["relationships"]:
            src_id = name_to_id.get(r["source"], r["source"])
            tgt_id = name_to_id.get(r["target"], r["target"])
            rel_id = f"R{uuid.uuid4().hex[:6].upper()}"

            existing_rel = db.query(Relationship).filter(
                Relationship.source == src_id,
                Relationship.target == tgt_id,
                Relationship.type == r["relationship"]
            ).first()

            if not existing_rel:
                rel = Relationship(
                    id=rel_id,
                    source=src_id,
                    target=tgt_id,
                    type=r["relationship"],
                    date=r.get("date"),
                    case_id=case_id,
                    confidence=r.get("confidence", 0.90),
                    provenance=f"NLP extraction from case {case_id}"
                )
                db.add(rel)
                GraphService.sync_relationship_to_graph(rel_id, src_id, tgt_id, r["relationship"], {"date": r.get("date")})

        db.commit()
