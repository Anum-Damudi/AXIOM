import uuid
import json
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import CaseReport, Case
from app.schemas import ReportCreate, ReportResponse, ApiResponse
from app.services import NlpService
from app.core.exceptions import NotFoundException

router = APIRouter()

@router.post("/cases/{case_id}/reports", response_model=ApiResponse[ReportResponse], status_code=status.HTTP_201_CREATED, tags=["Reports"])
def create_report(case_id: str, report_in: ReportCreate, db: Session = Depends(get_db)):
    """Upload a raw narrative case report and trigger automatic NLP extraction pipeline."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

    report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"
    report = CaseReport(
        id=report_id,
        case_id=case_id,
        report_text=report_in.report_text,
        processing_status="PENDING"
    )
    db.add(report)
    db.commit()

    # Trigger NLP Entity/Relationship Extraction Pipeline
    processed_report = NlpService.process_case_report(db, report.id)

    nlp_dict = None
    if processed_report.nlp_output:
        try:
            nlp_dict = json.loads(processed_report.nlp_output)
        except Exception:
            nlp_dict = None

    resp = ReportResponse(
        id=processed_report.id,
        case_id=processed_report.case_id,
        report_text=processed_report.report_text,
        processing_status=processed_report.processing_status,
        nlp_output=nlp_dict
    )
    return ApiResponse(success=True, data=resp)

@router.get("/cases/{case_id}/reports", response_model=ApiResponse[List[ReportResponse]], tags=["Reports"])
def get_case_reports(case_id: str, db: Session = Depends(get_db)):
    """Fetch all reports associated with a specific case."""
    reports = db.query(CaseReport).filter(CaseReport.case_id == case_id).all()
    results = []
    for r in reports:
        nlp_dict = None
        if r.nlp_output:
            try:
                nlp_dict = json.loads(r.nlp_output)
            except Exception:
                nlp_dict = None
        results.append(ReportResponse(
            id=r.id,
            case_id=r.case_id,
            report_text=r.report_text,
            processing_status=r.processing_status,
            nlp_output=nlp_dict
        ))
    return ApiResponse(success=True, data=results)

@router.get("/reports/{report_id}", response_model=ApiResponse[ReportResponse], tags=["Reports"])
def get_report(report_id: str, db: Session = Depends(get_db)):
    """Fetch report details and NLP extraction results."""
    r = db.query(CaseReport).filter(CaseReport.id == report_id).first()
    if not r:
        raise NotFoundException(message=f"Report {report_id} not found", code="REPORT_NOT_FOUND")

    nlp_dict = None
    if r.nlp_output:
        try:
            nlp_dict = json.loads(r.nlp_output)
        except Exception:
            nlp_dict = None

    resp = ReportResponse(
        id=r.id,
        case_id=r.case_id,
        report_text=r.report_text,
        processing_status=r.processing_status,
        nlp_output=nlp_dict
    )
    return ApiResponse(success=True, data=resp)
