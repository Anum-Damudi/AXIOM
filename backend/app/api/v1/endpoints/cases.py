import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models import Case, Person, Vehicle, Location, Relationship, User
from app.schemas import (
    CaseCreate, CaseUpdate, CaseResponse, RelatedCaseConnection,
    CytoscapeGraphData, CaseTimelineResponse, ApiResponse, MetaPagination,
    CaseEntityLinkCreate
)
from app.services import CaseService, CrossCaseService, GraphService
from app.core.security import get_current_user, require_roles
from app.core.exceptions import NotFoundException

router = APIRouter()

READ_ROLES = require_roles("ADMIN", "INVESTIGATOR", "OFFICER")
WRITE_ROLES = require_roles("ADMIN", "INVESTIGATOR")

@router.post("", response_model=ApiResponse[CaseResponse], status_code=status.HTTP_201_CREATED, tags=["Cases"])
def create_case(
    case_in: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Create a new investigation case (Admin/Investigator)."""
    case = CaseService.create_case(db, case_in, user_id=current_user.id)
    return ApiResponse(success=True, data=case)

@router.get("", response_model=ApiResponse[List[CaseResponse]], tags=["Cases"])
def get_cases(
    status: Optional[str] = Query(None, description="Filter by status: open, closed, under investigation"),
    priority: Optional[str] = Query(None, description="Filter by priority: low, medium, high, critical"),
    keyword: Optional[str] = Query(None, description="Search keyword in case title or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """List investigation cases with pagination and filtering."""
    cases, total = CaseService.get_cases(
        db, status=status, priority=priority, keyword=keyword, page=page, limit=limit
    )
    meta = MetaPagination(page=page, limit=limit, total=total)
    return ApiResponse(success=True, data=cases, meta=meta)

@router.get("/{case_id}", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch case details by case ID."""
    case = CaseService.get_case_by_id(db, case_id)
    return ApiResponse(success=True, data=case)

@router.patch("/{case_id}", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def update_case(
    case_id: str,
    case_in: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Update case status, priority, or details (Admin/Investigator)."""
    case = CaseService.update_case(db, case_id, case_in, user_id=current_user.id)
    return ApiResponse(success=True, data=case)

@router.post("/{case_id}/close", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def close_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Close an investigation case (Admin/Investigator), audit trail enforced."""
    case = CaseService.close_case(db, case_id, user_id=current_user.id)
    return ApiResponse(success=True, data=case, message=f"Case {case_id} closed")

@router.post("/{case_id}/reopen", response_model=ApiResponse[CaseResponse], tags=["Cases"])
def reopen_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Reopen a closed investigation case (Admin/Investigator), audit trail enforced."""
    case = CaseService.reopen_case(db, case_id, user_id=current_user.id)
    return ApiResponse(success=True, data=case, message=f"Case {case_id} reopened")

@router.delete("/{case_id}", response_model=ApiResponse[dict], tags=["Cases"])
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Delete an investigation case (Admin/Investigator)."""
    CaseService.delete_case(db, case_id, user_id=current_user.id)
    return ApiResponse(success=True, data={"message": f"Case {case_id} successfully deleted."})

@router.post("/{case_id}/entities", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED, tags=["Cases"])
def add_entity_to_case(
    case_id: str,
    entity_in: CaseEntityLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Create or reuse an entity, then link it to the case as INVOLVED_IN and compute related cases."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})

    entity_obj = None
    entity_type = (entity_in.type or "person").lower()
    if entity_type == "person":
        entity_obj = None
        if entity_in.entity_id:
            entity_obj = db.query(Person).filter(Person.id == entity_in.entity_id).first()
        if entity_obj is None:
            name = (entity_in.name or "").strip()
            if not name:
                return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})
            entity_obj = db.query(Person).filter(func.lower(Person.name) == name.lower()).first()
        if entity_obj is None:
            entity_obj = Person(
                id=f"P{uuid.uuid4().hex[:6].upper()}",
                name=name,
                role=(entity_in.role or "associate").upper(),
                age=entity_in.age,
                gender=entity_in.gender,
                height=entity_in.height,
                weight=entity_in.weight,
                occupation=entity_in.occupation,
                nationality=entity_in.nationality,
                address=entity_in.address,
                phone=entity_in.phone,
                email=entity_in.email,
                notes=entity_in.notes,
                aliases=entity_in.aliases,
                risk=(entity_in.risk or "MEDIUM").upper(),
                status=(entity_in.status or "ACTIVE").upper(),
                normalized_name=name.lower(),
            )
        else:
            person_values = entity_in.model_dump(exclude_unset=True, exclude={"type", "entity_id", "name", "plate_number"})
            for field in ("role", "risk", "status"):
                if field in person_values and person_values[field]:
                    person_values[field] = str(person_values[field]).upper()
            for field, value in person_values.items():
                if hasattr(entity_obj, field) and value is not None:
                    setattr(entity_obj, field, value.strip() if isinstance(value, str) and field not in {"role", "risk", "status"} else value)
        db.add(entity_obj)
        db.commit()
        db.refresh(entity_obj)
    elif entity_type == "vehicle":
        plate = (entity_in.plate_number or entity_in.name or "").strip().upper()
        if not plate:
            return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})
        entity_obj = db.query(Vehicle).filter(Vehicle.plate_number == plate).first()
        if not entity_obj:
            entity_obj = Vehicle(id=f"V{uuid.uuid4().hex[:6].upper()}", plate_number=plate, type="car")
            db.add(entity_obj)
            db.commit()
            db.refresh(entity_obj)
    elif entity_type == "location":
        name = (entity_in.name or "").strip()
        if not name:
            return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})
        entity_obj = db.query(Location).filter(Location.name == name).first()
        if not entity_obj:
            entity_obj = Location(id=f"L{uuid.uuid4().hex[:6].upper()}", name=name)
            db.add(entity_obj)
            db.commit()
            db.refresh(entity_obj)
    else:
        return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})

    if entity_obj is None:
        return ApiResponse(success=False, data={"case_id": case_id, "entity": None, "related_cases": []})

    existing_rel = db.query(Relationship).filter(
        Relationship.source == entity_obj.id,
        Relationship.target == case_id,
        Relationship.type == "INVOLVED_IN"
    ).first()
    if not existing_rel:
        rel = Relationship(
            id=f"R{uuid.uuid4().hex[:6].upper()}",
            source=entity_obj.id,
            target=case_id,
            type="INVOLVED_IN",
            confidence=0.95,
            provenance=f"Case entity link for {case_id}"
        )
        db.add(rel)
        db.commit()

    from app.services.audit_service import AuditService
    AuditService.log_action(
        db, action="LINK_ENTITY_TO_CASE", user_id=current_user.id,
        resource_type="case", resource_id=case_id,
        details={"entity_id": entity_obj.id, "entity_type": entity_type}
    )

    related = CrossCaseService.get_related_cases(db, case_id)
    return ApiResponse(success=True, data={"case_id": case_id, "entity_id": entity_obj.id, "entity_type": entity_type, "related_cases": related})

@router.get("/{case_id}/entities", response_model=ApiResponse[List[dict]], tags=["Cases"])
def get_case_entities(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch entities (people, vehicles, locations, phones) explicitly linked to a case.

    When nothing is linked yet, returns an empty list (no implicit global data leak).
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

    # 1. Find entities directly linked via relationships
    rels = db.query(Relationship).filter(
        (Relationship.target == case_id) | (Relationship.source == case_id) | (Relationship.case_id == case_id)
    ).all()

    linked_ids = set()
    for r in rels:
        if r.source != case_id:
            linked_ids.add(r.source)
        if r.target != case_id:
            linked_ids.add(r.target)

    entities_list = []
    seen = set()

    for eid in linked_ids:
        if eid.startswith("P"):
            p = db.query(Person).filter(Person.id == eid).first()
            if p and p.id not in seen:
                seen.add(p.id)
                entities_list.append({
                    "id": p.id,
                    "name": p.name,
                    "type": "Person",
                    "role": p.role or "associate",
                    "age": p.age,
                    "gender": p.gender,
                    "height": p.height,
                    "weight": p.weight,
                    "occupation": p.occupation,
                    "nationality": p.nationality,
                    "address": p.address,
                    "phone": p.phone,
                    "email": p.email,
                    "notes": p.notes,
                    "aliases": p.aliases,
                    "photo_path": p.photo_path,
                    "risk": p.risk or "MEDIUM",
                    "status": p.status or "ACTIVE",
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                })
        elif eid.startswith("V"):
            v = db.query(Vehicle).filter(Vehicle.id == eid).first()
            if v and v.id not in seen:
                seen.add(v.id)
                entities_list.append({"id": v.id, "name": v.plate_number, "type": "Vehicle", "role": v.type or "vehicle"})
        elif eid.startswith("L"):
            l = db.query(Location).filter(Location.id == eid).first()
            if l and l.id not in seen:
                seen.add(l.id)
                entities_list.append({"id": l.id, "name": l.name, "type": "Location", "role": "location"})
        elif eid.startswith("PN"):
            from app.models import PhoneNumber
            pn = db.query(PhoneNumber).filter(PhoneNumber.id == eid).first()
            if pn and pn.id not in seen:
                seen.add(pn.id)
                entities_list.append({"id": pn.id, "name": pn.number, "type": "Phone", "role": "phone"})

    return ApiResponse(success=True, data=entities_list)

@router.get("/{case_id}/related-cases", response_model=ApiResponse[List[RelatedCaseConnection]], tags=["Cases"])
def get_related_cases(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Cross-case intelligence engine: discover related cases connected through shared people, vehicles, or locations."""
    related = CrossCaseService.get_related_cases(db, case_id)
    return ApiResponse(success=True, data=related)

@router.get("/{case_id}/network", response_model=ApiResponse[CytoscapeGraphData], tags=["Cases"])
def get_case_network(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch Cytoscape.js formatted knowledge graph subgraph for a case."""
    subgraph = GraphService.get_case_subgraph(db, case_id)
    return ApiResponse(success=True, data=subgraph)

@router.get("/{case_id}/timeline", response_model=ApiResponse[CaseTimelineResponse], tags=["Cases", "Timeline"])
def get_case_timeline(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch chronological timeline of investigation events for a case."""
    timeline = CaseService.get_case_timeline(db, case_id)
    return ApiResponse(success=True, data=timeline)