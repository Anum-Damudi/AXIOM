import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.neo4j import neo4j_client
from app.models import CallRecord, PhoneNumber, PersonPhone

logger = logging.getLogger("axiom.phone_graph")

class PhoneGraphService:
    """Service for syncing phone data to Neo4j graph database."""
    
    @staticmethod
    def sync_phone_to_graph(db: Session, phone_id: str) -> bool:
        """Sync a single phone to Neo4j."""
        try:
            phone = db.query(PhoneNumber).filter(PhoneNumber.id == phone_id).first()
            if not phone:
                logger.warning(f"Phone {phone_id} not found")
                return False
            
            # Create/update phone node in Neo4j
            query = """
            MERGE (p:Phone {normalized: $normalized})
            SET p.number = $number,
                p.country_code = $country_code,
                p.is_active = $is_active,
                p.first_seen = $first_seen,
                p.last_seen = $last_seen
            RETURN p
            """
            
            neo4j_client.execute_query(
                query,
                {
                    "normalized": phone.normalized,
                    "number": phone.number,
                    "country_code": phone.country_code,
                    "is_active": phone.is_active,
                    "first_seen": phone.first_seen.isoformat() if phone.first_seen else None,
                    "last_seen": phone.last_seen.isoformat() if phone.last_seen else None
                }
            )
            
            # Sync person associations
            associations = db.query(PersonPhone).filter(PersonPhone.phone_id == phone_id).all()
            for assoc in associations:
                PhoneGraphService.sync_person_phone_association(db, assoc.id)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync phone {phone_id} to graph: {e}")
            return False
    
    @staticmethod
    def sync_person_phone_association(db: Session, association_id: str) -> bool:
        """Sync person-phone association to Neo4j."""
        try:
            assoc = db.query(PersonPhone).filter(PersonPhone.id == association_id).first()
            if not assoc:
                return False
            
            # Create relationship between Person and Phone
            query = """
            MATCH (p:Person {id: $person_id})
            MATCH (ph:Phone {normalized: $phone_normalized})
            MERGE (p)-[r:HAS_PHONE]->(ph)
            SET r.relationship_type = $relationship_type,
                r.is_primary = $is_primary,
                r.start_date = $start_date,
                r.end_date = $end_date
            RETURN r
            """
            
            # Get phone normalized number
            phone = db.query(PhoneNumber).filter(PhoneNumber.id == assoc.phone_id).first()
            if not phone:
                return False
            
            neo4j_client.execute_query(
                query,
                {
                    "person_id": assoc.person_id,
                    "phone_normalized": phone.normalized,
                    "relationship_type": assoc.relationship_type,
                    "is_primary": assoc.is_primary,
                    "start_date": assoc.start_date.isoformat() if assoc.start_date else None,
                    "end_date": assoc.end_date.isoformat() if assoc.end_date else None
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync association {association_id} to graph: {e}")
            return False
    
    @staticmethod
    def sync_call_records_to_graph(db: Session, cdr_import_id: str) -> int:
        """Sync all call records from a CDR import to Neo4j."""
        try:
            records = db.query(CallRecord).filter(CallRecord.cdr_import_id == cdr_import_id).all()
            synced = 0
            
            for record in records:
                if PhoneGraphService.sync_call_record_to_graph(db, record.id):
                    synced += 1
            
            logger.info(f"Synced {synced}/{len(records)} call records to graph")
            return synced
            
        except Exception as e:
            logger.error(f"Failed to sync CDR {cdr_import_id} to graph: {e}")
            return 0
    
    @staticmethod
    def sync_call_record_to_graph(db: Session, record_id: str) -> bool:
        """Sync a single call record to Neo4j."""
        try:
            record = db.query(CallRecord).filter(CallRecord.id == record_id).first()
            if not record:
                return False
            
            # Create CALL relationship between phones
            query = """
            MERGE (caller:Phone {normalized: $caller_normalized})
            MERGE (called:Phone {normalized: $called_normalized})
            MERGE (caller)-[r:CALLED]->(called)
            SET r.call_type = $call_type,
                r.start_time = $start_time,
                r.duration_seconds = $duration_seconds,
                r.tower_id = $tower_id
            RETURN r
            """
            
            neo4j_client.execute_query(
                query,
                {
                    "caller_normalized": record.caller_normalized,
                    "called_normalized": record.called_normalized,
                    "call_type": record.call_type,
                    "start_time": record.start_time.isoformat() if record.start_time else None,
                    "duration_seconds": record.duration_seconds,
                    "tower_id": record.tower_id
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync call record {record_id} to graph: {e}")
            return False
    
    @staticmethod
    def get_phone_network_graph(db: Session, phone_number: str, depth: int = 2) -> dict:
        """Get phone network graph from Neo4j."""
        try:
            from app.services.phone_service import PhoneService
            normalized = PhoneService.normalize_phone(phone_number)
            
            query = """
            MATCH (p:Phone {normalized: $normalized})
            CALL {
                WITH p
                MATCH (p)-[r:CALLED*1..2]-(other:Phone)
                RETURN other.normalized as phone, count(r) as strength
                ORDER BY strength DESC
                LIMIT 50
            }
            RETURN p.normalized as center_phone, collect({phone: phone, strength: strength}) as network
            """
            
            result = neo4j_client.execute_query(query, {"normalized": normalized, "depth": depth})
            
            if result and len(result) > 0:
                return {
                    "center_phone": result[0].get("center_phone"),
                    "network": result[0].get("network", [])
                }
            
            return {"center_phone": phone_number, "network": []}
            
        except Exception as e:
            logger.error(f"Failed to get phone network graph: {e}")
            return {"center_phone": phone_number, "network": []}
    
    @staticmethod
    def find_shortest_path(db: Session, phone1: str, phone2: str) -> dict:
        """Find shortest call path between two phones."""
        try:
            from app.services.phone_service import PhoneService
            norm1 = PhoneService.normalize_phone(phone1)
            norm2 = PhoneService.normalize_phone(phone2)
            
            query = """
            MATCH path = shortestPath((p1:Phone {normalized: $norm1})-[:CALLED*]-(p2:Phone {normalized: $norm2}))
            RETURN [node in nodes(path) | node.normalized] as path_nodes, length(path) as path_length
            """
            
            result = neo4j_client.execute_query(query, {"norm1": norm1, "norm2": norm2})
            
            if result and len(result) > 0:
                return {
                    "path": result[0].get("path_nodes", []),
                    "length": result[0].get("path_length", 0)
                }
            
            return {"path": [], "length": 0}
            
        except Exception as e:
            logger.error(f"Failed to find shortest path: {e}")
            return {"path": [], "length": 0}
