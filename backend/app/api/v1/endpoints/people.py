import uuid
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Person, Relationship, Case, User
from app.schemas import PersonCreate, PersonUpdate, PersonResponse, PersonConnectionsResponse, ApiResponse, MetaPagination
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.security import get_current_user, require_roles
from app.core.config import settings

router = APIRouter()

READ_ROLES = require_roles("ADMIN", "INVESTIGATOR", "OFFICER")
WRITE_ROLES = require_roles("ADMIN", "INVESTIGATOR")
PERSON_FIELDS = (
    "role", "age", "gender", "height", "weight", "occupation", "nationality",
    "address", "phone", "email", "notes", "aliases", "risk", "status",
)


def _clean_person_values(values: dict) -> dict:
    cleaned = {}
    for field in PERSON_FIELDS:
        if field not in values:
            continue
        value = values[field]
        if isinstance(value, str):
            value = value.strip() or None
        if field in {"role", "risk", "status"} and value:
            value = value.upper()
        cleaned[field] = value
    return cleaned


def _apply_person_values(person: Person, values: dict) -> bool:
    changed = False
    for field, value in _clean_person_values(values).items():
        if getattr(person, field) != value:
            setattr(person, field, value)
            changed = True
    return changed


@router.post("", response_model=ApiResponse[PersonResponse], status_code=status.HTTP_201_CREATED, tags=["People"])
def create_person(
    person_in: PersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Create a person entity or reuse the same name if it already exists (Admin/Investigator)."""
    name = person_in.name.strip()
    normalized_name = name.lower()
    existing = db.query(Person).filter(func.lower(Person.name) == normalized_name).first()
    values = person_in.model_dump(exclude_unset=True)
    if existing:
        changed = _apply_person_values(existing, values)
        if name != existing.name:
            existing.name = name
            changed = True
        if normalized_name != existing.normalized_name:
            existing.normalized_name = normalized_name
            changed = True
        if changed:
            db.commit()
            db.refresh(existing)
        return ApiResponse(success=True, data=PersonResponse.model_validate(existing))

    person = Person(
        id=f"P{uuid.uuid4().hex[:6].upper()}",
        name=name,
        normalized_name=normalized_name,
    )
    _apply_person_values(person, values)
    if not person.role:
        person.role = "associate"
    db.add(person)
    db.commit()
    db.refresh(person)

    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="CREATE_PERSON", user_id=current_user.id, resource_type="person", resource_id=person.id)
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.get("", response_model=ApiResponse[List[PersonResponse]], tags=["People"])
def get_people(
    role: Optional[str] = Query(None, description="Filter by role: suspect, witness, associate, victim"),
    keyword: Optional[str] = Query(None, description="Search name or ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """List people entities with filtering and pagination."""
    query = db.query(Person)
    if role:
        query = query.filter(func.lower(Person.role) == role.strip().lower())
    if keyword:
        pattern = f"%{keyword.strip()}%"
        query = query.filter(
            (Person.name.ilike(pattern))
            | (Person.id.ilike(pattern))
            | (Person.aliases.ilike(pattern))
            | (Person.occupation.ilike(pattern))
            | (Person.nationality.ilike(pattern))
        )

    total = query.count()
    people = query.offset((page - 1) * limit).limit(limit).all()
    meta = MetaPagination(page=page, limit=limit, total=total)

    return ApiResponse(success=True, data=[PersonResponse.model_validate(p) for p in people], meta=meta)

@router.get("/{person_id}", response_model=ApiResponse[PersonResponse], tags=["People"])
def get_person(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
    """Fetch person details by person ID."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.post("/{person_id}/photo", response_model=ApiResponse[PersonResponse], tags=["People"])
async def upload_person_photo(
    person_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Upload or replace a person's photo (Admin/Investigator). Images only, max 5MB."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")

    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise BadRequestException(message="Photo exceeds 5MB limit", code="PHOTO_TOO_LARGE")

    # Magic-byte validation: only genuine image signatures are accepted.
    IMAGE_SIGNATURES = {
        b"\xff\xd8\xff": "jpg",
        b"\x89PNG\r\n\x1a\n": "png",
        b"GIF87a": "gif",
        b"GIF89a": "gif",
        b"RIFF": "webp",  # further verified below
        b"BM": "bmp",
    }
    ext = None
    for sig, sig_ext in IMAGE_SIGNATURES.items():
        if content.startswith(sig):
            if sig_ext == "webp" and not content[8:12] == b"WEBP":
                continue
            ext = sig_ext
            break
    if ext is None:
        raise BadRequestException(message="Invalid photo type (magic bytes validation failed)", code="INVALID_PHOTO_TYPE")

    photos_dir = os.path.join(settings.UPLOAD_DIR, "photos")
    os.makedirs(photos_dir, exist_ok=True)
    rel_path = f"photos/{person_id}{os.path.extsep}{ext}"
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)
    with open(abs_path, "wb") as f:
        f.write(content)

    # Remove a previous photo for the same person if it exists.
    if person.photo_path:
        old = os.path.join(settings.UPLOAD_DIR, person.photo_path)
        if old != abs_path and os.path.exists(old):
            try:
                os.remove(old)
            except OSError:
                pass

    person.photo_path = rel_path
    db.commit()
    db.refresh(person)

    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="UPDATE_PERSON_PHOTO", user_id=current_user.id, resource_type="person", resource_id=person_id)
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.delete("/{person_id}/photo", response_model=ApiResponse[PersonResponse], tags=["People"])
def delete_person_photo(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Remove a person's stored photo (Admin/Investigator)."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")
    if person.photo_path:
        old = os.path.join(settings.UPLOAD_DIR, person.photo_path)
        if os.path.exists(old):
            try:
                os.remove(old)
            except OSError:
                pass
        person.photo_path = None
        db.commit()
        db.refresh(person)

    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="DELETE_PERSON_PHOTO", user_id=current_user.id, resource_type="person", resource_id=person_id)
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.patch("/{person_id}", response_model=ApiResponse[PersonResponse], tags=["People"])
def update_person(
    person_id: str,
    person_in: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Update person details (Admin/Investigator)."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")

    update_data = person_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data.get("name"):
        update_data["name"] = update_data["name"].strip()
    changed = _apply_person_values(person, update_data)
    if "name" in update_data and update_data["name"] and update_data["name"] != person.name:
        person.name = update_data["name"]
        changed = True
    if "name" in update_data and person.name:
        normalized_name = person.name.lower()
        if normalized_name != person.normalized_name:
            person.normalized_name = normalized_name
            changed = True
    if changed:
        db.commit()
        db.refresh(person)

    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="UPDATE_PERSON", user_id=current_user.id, resource_type="person", resource_id=person_id)
    return ApiResponse(success=True, data=PersonResponse.model_validate(person))

@router.delete("/{person_id}", response_model=ApiResponse[dict], tags=["People"])
def delete_person(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(WRITE_ROLES)
):
    """Delete a person entity (Admin/Investigator)."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise NotFoundException(message=f"Person {person_id} not found", code="PERSON_NOT_FOUND")
    if person.photo_path:
        photo_path = os.path.join(settings.UPLOAD_DIR, person.photo_path)
        if os.path.exists(photo_path):
            try:
                os.remove(photo_path)
            except OSError:
                pass
    db.query(Relationship).filter(
        (Relationship.source == person_id) | (Relationship.target == person_id)
    ).delete(synchronize_session=False)
    db.delete(person)
    db.commit()

    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="DELETE_PERSON", user_id=current_user.id, resource_type="person", resource_id=person_id)
    return ApiResponse(success=True, data={"message": f"Person {person_id} successfully deleted."})

@router.get("/{person_id}/connections", response_model=ApiResponse[PersonConnectionsResponse], tags=["People", "Network"])
def get_person_connections(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(READ_ROLES)
):
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
