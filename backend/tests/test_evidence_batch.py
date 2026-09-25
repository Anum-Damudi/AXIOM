import pytest
import os
import tempfile
from io import BytesIO
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.models import Evidence, Case, EvidenceSuggestion
from app.services.evidence_service import EvidenceService

@pytest.fixture
def db(service_db):
    """Fresh isolated database for this test."""
    yield service_db

@pytest.fixture
def test_case(db: Session):
    case = Case(id="CASE-001", title="Test Case", date="2024-01-01", status="open")
    db.add(case)
    db.commit()
    db.refresh(case)
    return case

def create_test_upload_file(filename: str, content: bytes) -> UploadFile:
    """Helper to create a test UploadFile."""
    file = UploadFile(filename=filename, file=BytesIO(content))
    return file

def test_magic_bytes_validation(db: Session):
    """Test magic bytes validation for file types."""
    from app.services.evidence_service import validate_magic_bytes
    
    # JPEG magic bytes
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF'
    assert validate_magic_bytes(jpeg_data) == "image/jpeg"
    
    # PNG magic bytes
    png_data = b'\x89\x50\x4e\x47\x0d\x0a\x1a\x0a'
    assert validate_magic_bytes(png_data) == "image/png"
    
    # Invalid data
    invalid_data = b'\x00\x00\x00\x00'
    assert validate_magic_bytes(invalid_data) is None

def test_duplicate_detection_exact(db: Session, test_case: Case):
    """Test exact duplicate detection via SHA-256."""
    from app.services.evidence_service import check_duplicate
    
    # Create existing evidence
    existing = Evidence(
        id="EV-001",
        case_id="CASE-001",
        file_name="test.jpg",
        file_path="/tmp/test.jpg",
        mime_type="image/jpeg",
        file_size=100,
        sha256="abc123"
    )
    db.add(existing)
    db.commit()
    
    # Check for duplicate
    is_dup, dup_id = check_duplicate(db, "abc123", None)
    assert is_dup is True
    assert dup_id == "EV-001"

def test_duplicate_detection_perceptual(db: Session, test_case: Case):
    """Test perceptual hash duplicate detection."""
    from app.services.evidence_service import check_duplicate

    # 16-char hex = a valid imagehash (8x8 phash) representation.
    PHASH = "a1b2c3d4c5e6f7a8"
    # Create existing evidence with perceptual hash
    existing = Evidence(
        id="EV-001",
        case_id="CASE-001",
        file_name="test.jpg",
        file_path="/tmp/test.jpg",
        mime_type="image/jpeg",
        file_size=100,
        sha256="abc123",
        perceptual_hash=PHASH
    )
    db.add(existing)
    db.commit()
    
    # This test requires imagehash to be installed
    try:
        import imagehash
        # Identical perceptual hash (different SHA-256) -> matches within threshold
        is_dup, dup_id = check_duplicate(db, "different_sha256", PHASH)
        assert is_dup is True
        assert dup_id == "EV-001"
    except ImportError:
        pytest.skip("imagehash not installed")

def test_batch_upload_success(db: Session, test_case: Case):
    """Test successful batch upload."""
    # Create test JPEG data
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF' + b'\x00' * 1000
    
    files = [
        create_test_upload_file("test1.jpg", jpeg_data + b"\x01"),
        create_test_upload_file("test2.jpg", jpeg_data + b"\x02")
    ]
    
    result = EvidenceService.upload_batch(
        db,
        case_id="CASE-001",
        files=files,
        uploader_id="U001"
    )
    
    assert result.total_files == 2
    assert result.successful == 2
    assert result.failed == 0
    assert len(result.results) == 2
    assert all(r.success for r in result.results)

def test_batch_upload_duplicate_detection(db: Session, test_case: Case):
    """Test batch upload with duplicate detection."""
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF' + b'\x00' * 1000
    
    # Upload first file
    files1 = [create_test_upload_file("test.jpg", jpeg_data)]
    result1 = EvidenceService.upload_batch(db, "CASE-001", files1, "U001")
    assert result1.successful == 1
    
    # Upload same file again (should be detected as duplicate)
    files2 = [create_test_upload_file("test2.jpg", jpeg_data)]
    result2 = EvidenceService.upload_batch(db, "CASE-001", files2, "U001")
    assert result2.duplicates == 1
    assert result2.results[0].is_duplicate is True

def test_batch_upload_invalid_file_type(db: Session, test_case: Case):
    """Test batch upload rejects invalid file types."""
    # Invalid magic bytes
    invalid_data = b'\x00\x00\x00\x00' * 100
    
    files = [create_test_upload_file("test.bin", invalid_data)]
    result = EvidenceService.upload_batch(db, "CASE-001", files, "U001")
    
    assert result.failed == 1
    assert result.results[0].success is False
    assert "magic bytes" in result.results[0].error.lower()

def test_batch_upload_too_many_files(db: Session, test_case: Case):
    """Test batch upload respects file limit."""
    from app.core.exceptions import BadRequestException
    
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF' + b'\x00' * 100
    files = [create_test_upload_file(f"test{i}.jpg", jpeg_data) for i in range(25)]
    
    with pytest.raises(BadRequestException) as exc:
        EvidenceService.upload_batch(db, "CASE-001", files, "U001")
    
    assert exc.value.detail["code"] == "TOO_MANY_FILES"

def test_suggestion_confirmation(db: Session, test_case: Case):
    """Test confirming an evidence suggestion."""
    from datetime import datetime, timezone
    
    # Create evidence
    evidence = Evidence(
        id="EV-001",
        case_id="CASE-001",
        file_name="test.jpg",
        file_path="/tmp/test.jpg",
        mime_type="image/jpeg",
        file_size=100
    )
    db.add(evidence)
    
    # Create suggestion
    suggestion = EvidenceSuggestion(
        id="ES-001",
        evidence_id="EV-001",
        suggestion_type="OBJECT_MATCH",
        target_entity_type="person",
        target_entity_id="P-001",
        confidence=85,
        status="PENDING_REVIEW"
    )
    db.add(suggestion)
    db.commit()
    
    # Confirm suggestion
    confirmed = EvidenceService.confirm_suggestion(db, "ES-001", "U001", "Looks correct")
    
    assert confirmed.status == "CONFIRMED"
    assert confirmed.reviewed_by == "U001"
    assert confirmed.reviewed_at is not None

def test_suggestion_rejection(db: Session, test_case: Case):
    """Test rejecting an evidence suggestion."""
    from datetime import datetime, timezone
    
    # Create evidence
    evidence = Evidence(
        id="EV-001",
        case_id="CASE-001",
        file_name="test.jpg",
        file_path="/tmp/test.jpg",
        mime_type="image/jpeg",
        file_size=100
    )
    db.add(evidence)
    
    # Create suggestion
    suggestion = EvidenceSuggestion(
        id="ES-001",
        evidence_id="EV-001",
        suggestion_type="OBJECT_MATCH",
        status="PENDING_REVIEW"
    )
    db.add(suggestion)
    db.commit()
    
    # Reject suggestion
    rejected = EvidenceService.reject_suggestion(db, "ES-001", "U001", "Not relevant")
    
    assert rejected.status == "REJECTED"
    assert rejected.reviewed_by == "U001"
