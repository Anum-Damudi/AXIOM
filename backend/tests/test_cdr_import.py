import pytest
import tempfile
import os
from sqlalchemy.orm import Session
from app.models import CDRImport, Case
from app.services.phone_service import PhoneService
from app.core.exceptions import BadRequestException

@pytest.fixture
def db(service_db):
    """Fresh isolated database for this test."""
    yield service_db

@pytest.fixture
def test_case(db: Session):
    """Create a test case."""
    case = Case(id="CASE-001", title="Test Case", date="2024-01-01", status="open")
    db.add(case)
    db.commit()
    db.refresh(case)
    return case

def test_cdr_import_csv(db: Session, test_case: Case):
    """Test CDR CSV import."""
    # Create a temporary CSV file
    csv_content = """caller_number,called_number,call_type,start_time,duration_seconds,tower_id
+919876543210,+919876543211,outgoing,2024-01-15T10:30:00,300,CT-001
+919876543211,+919876543212,outgoing,2024-01-16T14:20:00,300,CT-002
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_path = f.name
    
    try:
        # Import CDR
        cdr_import = PhoneService.import_cdr_csv(
            db,
            case_id="CASE-001",
            file_path=temp_path,
            operator="JIO",
            uploaded_by="test_user"
        )
        
        assert cdr_import is not None
        assert cdr_import.case_id == "CASE-001"
        assert cdr_import.status == "COMPLETED"
        assert cdr_import.total_records == 2
        
        # Verify phone numbers were created
        from app.models import PhoneNumber
        phones = db.query(PhoneNumber).all()
        assert len(phones) >= 2
        
        # Verify call records were created
        from app.models import CallRecord
        call_records = db.query(CallRecord).filter(CallRecord.cdr_import_id == cdr_import.id).all()
        assert len(call_records) == 2
        
    finally:
        os.unlink(temp_path)

def test_cdr_import_invalid_file(db: Session, test_case: Case):
    """Test CDR import with invalid file."""
    # Create a file that doesn't exist
    with pytest.raises(Exception):
        PhoneService.import_cdr_csv(
            db,
            case_id="CASE-001",
            file_path="/nonexistent/file.csv",
            operator="JIO"
        )

def test_cdr_import_missing_columns(db: Session, test_case: Case):
    """Test CDR import with missing required columns."""
    # Create a CSV with missing columns
    csv_content = """caller_number,called_number
+919876543210,+919876543211
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_path = f.name
    
    try:
        # Missing required timestamp column is a validation error.
        with pytest.raises(BadRequestException) as exc_info:
            PhoneService.import_cdr_csv(
                db,
                case_id="CASE-001",
                file_path=temp_path,
                operator="JIO"
            )
        assert exc_info.value.detail["code"] == "MISSING_TIMESTAMP_COLUMN"

    finally:
        os.unlink(temp_path)
