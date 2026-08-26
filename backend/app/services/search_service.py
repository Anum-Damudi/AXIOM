from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models import Case, CaseReport, Person, Vehicle, Location, Evidence
from app.schemas.search import UnifiedSearchResponse, SearchCategorizedResults

class SearchService:
    @staticmethod
    def unified_search(db: Session, query_str: str) -> UnifiedSearchResponse:
        q = query_str.strip().lower()
        if not q:
            return UnifiedSearchResponse(
                query=query_str,
                total_matches=0,
                results=SearchCategorizedResults()
            )

        pattern = f"%{q}%"

        # Search Cases
        cases = db.query(Case).filter(
            (Case.id.ilike(pattern)) | (Case.title.ilike(pattern)) | (Case.status.ilike(pattern))
        ).limit(20).all()
        case_results = [{"id": c.id, "title": c.title, "date": c.date, "status": c.status} for c in cases]

        # Search People
        people = db.query(Person).filter(
            (Person.id.ilike(pattern)) | (Person.name.ilike(pattern)) | (Person.role.ilike(pattern))
        ).limit(20).all()
        people_results = [{"id": p.id, "name": p.name, "age": p.age, "role": p.role} for p in people]

        # Search Vehicles
        vehicles = db.query(Vehicle).filter(
            (Vehicle.id.ilike(pattern)) | (Vehicle.plate_number.ilike(pattern)) | (Vehicle.type.ilike(pattern))
        ).limit(20).all()
        vehicle_results = [{"id": v.id, "plate_number": v.plate_number, "type": v.type} for v in vehicles]

        # Search Locations
        locations = db.query(Location).filter(
            (Location.id.ilike(pattern)) | (Location.name.ilike(pattern))
        ).limit(20).all()
        location_results = [{"id": l.id, "name": l.name, "lat": l.lat, "lng": l.lng} for l in locations]

        # Search Evidence
        evidence = db.query(Evidence).filter(
            (Evidence.id.ilike(pattern)) | (Evidence.title.ilike(pattern)) | (Evidence.file_name.ilike(pattern))
        ).limit(20).all()
        evidence_results = [{"id": e.id, "case_id": e.case_id, "title": e.title, "file_name": e.file_name} for e in evidence]

        total = len(case_results) + len(people_results) + len(vehicle_results) + len(location_results) + len(evidence_results)

        return UnifiedSearchResponse(
            query=query_str,
            total_matches=total,
            results=SearchCategorizedResults(
                cases=case_results,
                people=people_results,
                vehicles=vehicle_results,
                locations=location_results,
                evidence=evidence_results
            )
        )
