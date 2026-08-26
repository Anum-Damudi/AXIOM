import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Case, Relationship, Person, Vehicle, Location
from app.schemas.case import RelatedCaseConnection

logger = logging.getLogger("axiom.cross_case")

class CrossCaseService:
    @staticmethod
    def get_related_cases(db: Session, case_id: str) -> List[RelatedCaseConnection]:
        target_case = db.query(Case).filter(Case.id == case_id).first()
        if not target_case:
            return []

        # 1. Find all entities connected directly to target_case
        target_rels = db.query(Relationship).filter(
            (Relationship.case_id == case_id) | (Relationship.target == case_id) | (Relationship.source == case_id)
        ).all()

        connected_entity_ids = set()
        for r in target_rels:
            if r.source != case_id:
                connected_entity_ids.add(r.source)
            if r.target != case_id:
                connected_entity_ids.add(r.target)

        if not connected_entity_ids:
            return []

        # 2. Find other cases connected to any of these entities
        other_rels = db.query(Relationship).filter(
            (Relationship.source.in_(connected_entity_ids)) | (Relationship.target.in_(connected_entity_ids))
        ).all()

        related_connections: List[RelatedCaseConnection] = []
        seen_pairs = set()

        for r in other_rels:
            other_case_id = None
            entity_id = None

            if r.case_id and r.case_id != case_id:
                other_case_id = r.case_id
                entity_id = r.source if r.source in connected_entity_ids else r.target
            elif r.target.startswith("C") and r.target != case_id:
                other_case_id = r.target
                entity_id = r.source
            elif r.source.startswith("C") and r.source != case_id:
                other_case_id = r.source
                entity_id = r.target

            if other_case_id and entity_id:
                pair_key = (other_case_id, entity_id)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                other_case = db.query(Case).filter(Case.id == other_case_id).first()
                if not other_case:
                    continue

                entity_name, conn_type = CrossCaseService._get_entity_info(db, entity_id)

                provenance_text = (
                    f"Investigative lead detected: {conn_type.replace('_', ' ').title()} '{entity_name}' "
                    f"({entity_id}) links Case {case_id} with Case {other_case_id}."
                )

                related_connections.append(RelatedCaseConnection(
                    case_id=other_case_id,
                    title=other_case.title,
                    connection_type=conn_type,
                    entity_id=entity_id,
                    entity_name=entity_name,
                    confidence=0.92,
                    provenance=provenance_text
                ))

        return related_connections

    @staticmethod
    def _get_entity_info(db: Session, entity_id: str):
        if entity_id.startswith("P"):
            person = db.query(Person).filter(Person.id == entity_id).first()
            name = person.name if person else entity_id
            return name, "shared_person"
        elif entity_id.startswith("V"):
            vehicle = db.query(Vehicle).filter(Vehicle.id == entity_id).first()
            plate = vehicle.plate_number if vehicle else entity_id
            return plate, "shared_vehicle"
        elif entity_id.startswith("L"):
            loc = db.query(Location).filter(Location.id == entity_id).first()
            name = loc.name if loc else entity_id
            return name, "shared_location"
        return entity_id, "shared_entity"
