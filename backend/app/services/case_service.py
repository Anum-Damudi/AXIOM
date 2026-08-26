import uuid
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import Case, CaseReport, Evidence, Relationship, Person, Vehicle, Location
from app.schemas.case import CaseCreate, CaseUpdate, CaseResponse
from app.schemas.timeline import CaseTimelineResponse, TimelineEvent
from app.core.exceptions import NotFoundException, ConflictException
from app.services.audit_service import AuditService

class CaseService:
    @staticmethod
    def create_case(db: Session, case_in: CaseCreate, user_id: str = None) -> CaseResponse:
        case_id = f"C{uuid.uuid4().hex[:6].upper()}"
        case = Case(
            id=case_id,
            title=case_in.title,
            date=case_in.date,
            status=case_in.status or "open",
            priority=case_in.priority or "medium",
            case_type=case_in.case_type or "Criminal Investigation",
            investigating_officer=case_in.investigating_officer or "Officer Inspector"
        )
        db.add(case)
        db.commit()
        db.refresh(case)

        AuditService.log_action(db, action="CREATE_CASE", user_id=user_id, resource_type="case", resource_id=case.id)

        return CaseResponse.model_validate(case)

    @staticmethod
    def get_cases(
        db: Session,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Tuple[List[CaseResponse], int]:
        query = db.query(Case)
        if status:
            query = query.filter(Case.status == status)
        if priority:
            query = query.filter(Case.priority == priority)
        if keyword:
            pattern = f"%{keyword}%"
            query = query.filter((Case.title.ilike(pattern)) | (Case.id.ilike(pattern)))

        total = query.count()
        offset = (page - 1) * limit
        cases = query.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()

        return [CaseResponse.model_validate(c) for c in cases], total

    @staticmethod
    def get_case_by_id(db: Session, case_id: str) -> CaseResponse:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")
        return CaseResponse.model_validate(case)

    @staticmethod
    def update_case(db: Session, case_id: str, case_in: CaseUpdate, user_id: str = None) -> CaseResponse:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        update_data = case_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(case, field, value)

        db.commit()
        db.refresh(case)

        AuditService.log_action(db, action="UPDATE_CASE", user_id=user_id, resource_type="case", resource_id=case_id)

        return CaseResponse.model_validate(case)

    @staticmethod
    def delete_case(db: Session, case_id: str, user_id: str = None):
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        db.delete(case)
        db.commit()

        AuditService.log_action(db, action="DELETE_CASE", user_id=user_id, resource_type="case", resource_id=case_id)

    @staticmethod
    def get_case_timeline(db: Session, case_id: str) -> CaseTimelineResponse:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        events: List[TimelineEvent] = []

        # 1. Case Creation Event
        events.append(TimelineEvent(
            id=f"EVT-CREATE-{case.id}",
            timestamp=case.date,
            type="case_created",
            description=f"Case '{case.title}' created and registered.",
            source="case"
        ))

        # 2. Case Reports Events
        reports = db.query(CaseReport).filter(CaseReport.case_id == case_id).all()
        for r in reports:
            events.append(TimelineEvent(
                id=f"EVT-REP-{r.id}",
                timestamp=r.created_at.isoformat() if r.created_at else case.date,
                type="report_submitted",
                description=f"Case Report submitted ({r.processing_status}): '{r.report_text[:60]}...'",
                source="report"
            ))

        # 3. Evidence Events
        evidence = db.query(Evidence).filter(Evidence.case_id == case_id).all()
        for e in evidence:
            events.append(TimelineEvent(
                id=f"EVT-EV-{e.id}",
                timestamp=e.created_at.isoformat() if e.created_at else case.date,
                type="evidence_uploaded",
                description=f"Evidence file '{e.file_name}' uploaded ({e.mime_type}).",
                source="evidence"
            ))

        # 4. Relationship Discovery Events
        relationships = db.query(Relationship).filter(
            (Relationship.case_id == case_id) | (Relationship.target == case_id) | (Relationship.source == case_id)
        ).all()
        for rel in relationships:
            rel_date = rel.date or case.date
            events.append(TimelineEvent(
                id=f"EVT-REL-{rel.id}",
                timestamp=rel_date,
                type="relationship_discovered",
                description=f"Intelligence link discovered: {rel.source} -[{rel.type}]-> {rel.target}",
                source="graph"
            ))

        # Sort events chronologically
        events.sort(key=lambda x: x.timestamp)

        return CaseTimelineResponse(case_id=case_id, events=events)
