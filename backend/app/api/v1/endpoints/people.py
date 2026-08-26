from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Person, Relationship, Case
from app.schemas import PersonResponse, PersonConnectionsResponse, ApiResponse, MetaPagination
from app.core.exceptions import NotFoundException

router = APIRouter()

@router.get("", response_model=ApiResponse[List[PersonResponse]], tags=["People"])
def get_people(
    role: Optional[str] = Query(None, description="Filter by role: suspect, witness, associate, victim"),
    keyword: Optional[str] = Query(None, description="Search name or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List people entities with filtering and pagination."""
    query = db.query(Person)
    if role:
        query = query.filter(Person.role == role)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter((Person.name.ilike(pattern)) | (Person.id.ilike(pattern)))

    total = query.count()
    people = query.offset((page - 1) * limit).limit(limit).all()
    meta = MetaPagination(page=page, limit=limit, total=total)

    return ApiResponse(success=True, data=[PersonResponse.model_validate(p) for p in people], meta=meta)

@router.get("/{person_id}", response_model=ApiResponse[PersonResponse], tags=["People"])
def get_person(person_id: str, db: Session = Depends(get_db)):
    """Fetch person details by person ID."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.get("/{person_id}/connections", response_model=ApiResponse[PersonConnectionsResponse], tags=["People", "Network"])
def get_person_connections(person_id: str, db: Session = Depends(get_db)):
    """Fetch direct graph connections and associated cases for a person."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")

    rels = db.query(Relationship).filter(
        (Relationship.source == person_id) | (Relationship.target == person_id)
    ).all()

    direct_connections = []
    associated_case_ids = set()

    for r in rels:
        target_id = r.target if r.source == person_id else r.source
        direct_connections.append({
            "relationship_id": r.id,
            "connected_entity_id": target_id,
            "relationship_type": r.type,
            "date": r.date
        })
        if r.case_id:
            associated_case_ids.add(r.case_id)
        if target_id.startswith("C"):
            associated_case_ids.add(target_id)

    cases = db.query(Case).filter(Case.id.in_(list(associated_case_ids))).all()
    associated_cases = [{"id": c.id, "title": c.title, "status": c.status} for c in cases]

    resp = PersonConnectionsResponse(
        person=PersonResponse.model_validate(person),
        direct_connections=direct_connections,
        associated_cases=associated_cases
    )

    return ApiResponse(success=True, data=resp)
