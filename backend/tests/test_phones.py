import pytest
from sqlalchemy.orm import Session
from app.models import PhoneNumber, PersonPhone, CellTower, CallRecord, CDRImport, Case
from app.services.phone_service import PhoneService

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

def test_normalize_phone(db: Session):
    """Test phone number normalization."""
    # Test Indian phone number
    normalized = PhoneService.normalize_phone("9876543210")
    assert normalized == "+919876543210"
    
    # Test with country code
    normalized = PhoneService.normalize_phone("+919876543210")
    assert normalized == "+919876543210"

def test_get_or_create_phone(db: Session):
    """Test getting or creating a phone number."""
    # Create new phone
    phone = PhoneService.get_or_create_phone(db, "9876543210")
    assert phone is not None
    assert phone.normalized == "+919876543210"
    
    # Get existing phone
    phone2 = PhoneService.get_or_create_phone(db, "9876543210")
    assert phone2.id == phone.id

def test_phone_profile(db: Session, test_case: Case):
    """Test phone profile generation."""
    # Create phone
    phone = PhoneService.get_or_create_phone(db, "9876543210")
    
    # Create person-phone association
    from app.models import Person
    person = Person(id="P-001", name="Test Person", role="suspect", normalized_name="test person")
    db.add(person)
    db.commit()
    
    association = PersonPhone(
        id="PP-001",
        person_id="P-001",
        phone_id=phone.id,
        relationship_type="primary",
        is_primary=True
    )
    db.add(association)
    db.commit()
    
    # Get profile
    profile = PhoneService.get_phone_profile(db, "9876543210")
    assert profile.phone.id == phone.id
    assert len(profile.associated_people) == 1
    assert profile.total_calls == 0

def test_burner_detection(db: Session):
    """Test burner phone detection."""
    # Create a phone with short lifespan and low activity
    from datetime import datetime, timezone, timedelta
    phone = PhoneNumber(
        id="PN-001",
        number="9876543210",
        normalized="+919876543210",
        country_code="IN",
        is_active=True,
        first_seen=datetime.now(timezone.utc) - timedelta(days=10),
        last_seen=datetime.now(timezone.utc) - timedelta(days=5)
    )
    db.add(phone)
    db.commit()
    
    # Detect burner
    result = PhoneService.detect_burner(db, "9876543210")
    assert result is not None
    assert result.phone_number == "9876543210"
