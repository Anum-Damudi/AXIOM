import pytest
from sqlalchemy.orm import Session
from app.models import LedgerEntry, LedgerBlock, CustodyTransfer, Evidence, Case
from app.services.ledger_service import LedgerService
from app.models.ledger import EntryType

@pytest.fixture
def db(service_db):
    """Fresh isolated database for this test."""
    yield service_db

def test_genesis_block_creation(db: Session):
    """Test genesis block creation."""
    genesis = LedgerService.create_genesis_block(db)
    assert genesis is not None
    assert genesis.index == 0
    assert genesis.prev_hash == "0" * 64

def test_create_entry(db: Session):
    """Test creating a ledger entry."""
    entry = LedgerService.create_entry(
        db=db,
        entry_type=EntryType.EVIDENCE_REGISTERED.value,
        case_id="CASE-001",
        actor_id="U001",
        payload={"evidence_id": "EV-001", "test": "data"},
        evidence_id="EV-001"
    )
    
    assert entry.id is not None
    assert entry.entry_type == EntryType.EVIDENCE_REGISTERED.value
    assert entry.block_id is None  # Not sealed yet

def test_seal_block(db: Session):
    """Test sealing unsealed entries into a block."""
    LedgerService.create_genesis_block(db)
    # Create multiple entries
    for i in range(5):
        LedgerService.create_entry(
            db=db,
            entry_type=EntryType.EVIDENCE_REGISTERED.value,
            case_id="CASE-001",
            actor_id="U001",
            payload={"evidence_id": f"EV-{i}", "test": "data"},
            evidence_id=f"EV-{i}"
        )
    
    # Seal the block
    block = LedgerService.seal_block(db, sealed_by="U001")
    
    assert block is not None
    assert block.index == 1  # After genesis
    assert block.merkle_root is not None
    
    # Verify entries are linked to block
    entries = db.query(LedgerEntry).filter(LedgerEntry.block_id == block.id).all()
    assert len(entries) == 5

def test_verify_chain_valid(db: Session):
    """Test chain verification with valid chain."""
    LedgerService.create_genesis_block(db)
    
    # Create and seal entries
    LedgerService.create_entry(
        db=db,
        entry_type=EntryType.EVIDENCE_REGISTERED.value,
        case_id="CASE-001",
        actor_id="U001",
        payload={"test": "data"}
    )
    LedgerService.seal_block(db, sealed_by="system")
    
    valid, broken_at = LedgerService.verify_chain(db)
    assert valid is True
    assert broken_at is None

def test_verify_chain_tampered(db: Session):
    """Test chain verification detects tampering."""
    LedgerService.create_genesis_block(db)
    
    # Create and seal entries
    LedgerService.create_entry(
        db=db,
        entry_type=EntryType.EVIDENCE_REGISTERED.value,
        case_id="CASE-001",
        actor_id="U001",
        payload={"test": "data"}
    )
    block = LedgerService.seal_block(db, sealed_by="system")
    
    # Tamper with block hash
    original_hash = block.block_hash
    block.block_hash = "0" * 64
    db.commit()
    
    valid, broken_at = LedgerService.verify_chain(db)
    assert valid is False
    assert broken_at == block.index
    
    # Restore for cleanup
    block.block_hash = original_hash
    db.commit()

def test_merkle_proof(db: Session):
    """Test Merkle proof generation."""
    # Create entries and seal
    entry = LedgerService.create_entry(
        db=db,
        entry_type=EntryType.EVIDENCE_REGISTERED.value,
        case_id="CASE-001",
        actor_id="U001",
        payload={"test": "data"}
    )
    LedgerService.seal_block(db, sealed_by="system")
    
    proof, block_index = LedgerService.get_merkle_proof(db, entry.id)
    
    assert block_index >= 0
    assert isinstance(proof, list)

def test_custody_transfer(db: Session):
    """Test custody transfer functionality."""
    # Create test case and evidence
    case = Case(id="CASE-001", title="Test Case", date="2024-01-01", status="open")
    db.add(case)
    
    evidence = Evidence(
        id="EV-001",
        case_id="CASE-001",
        file_name="test.jpg",
        file_path="/tmp/test.jpg",
        mime_type="image/jpeg",
        file_size=1024,
        current_custodian="U001"
    )
    db.add(evidence)
    db.commit()
    
    # Transfer custody
    transfer = LedgerService.transfer_custody(
        db=db,
        evidence_id="EV-001",
        from_user_id="U001",
        to_user_id="U002",
        reason="Case reassignment"
    )
    
    assert transfer.id is not None
    assert transfer.from_user_id == "U001"
    assert transfer.to_user_id == "U002"
    
    # Verify evidence custodian updated
    db.refresh(evidence)
    assert evidence.current_custodian == "U002"

def test_evidence_verification_intact(db: Session):
    """Test evidence verification for intact file."""
    import tempfile
    import os
    
    # Create test file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(b"test content")
        file_path = f.name
    
    try:
        # Create case and evidence
        case = Case(id="CASE-001", title="Test Case", date="2024-01-01", status="open")
        db.add(case)
        
        evidence = Evidence(
            id="EV-001",
            case_id="CASE-001",
            file_name="test.jpg",
            file_path=file_path,
            mime_type="image/jpeg",
            file_size=12,
            sha256="6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72"  # SHA-256 of "test content"
        )
        db.add(evidence)
        
        # Create ledger entry
        LedgerService.create_entry(
            db=db,
            entry_type=EntryType.EVIDENCE_REGISTERED.value,
            case_id="CASE-001",
            actor_id="U001",
            payload={"evidence_id": "EV-001", "sha256": evidence.sha256},
            evidence_id="EV-001"
        )
        db.commit()
        
        # Verify
        status, stored_hash, computed_hash = LedgerService.verify_evidence(db, "EV-001")
        assert status == "INTACT"
        assert stored_hash == computed_hash
    finally:
        os.unlink(file_path)

def test_evidence_verification_tampered(db: Session):
    """Test evidence verification detects tampering."""
    import tempfile
    import os
    
    # Create test file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(b"original content")
        file_path = f.name
    
    try:
        # Create case and evidence
        case = Case(id="CASE-001", title="Test Case", date="2024-01-01", status="open")
        db.add(case)
        
        evidence = Evidence(
            id="EV-001",
            case_id="CASE-001",
            file_name="test.jpg",
            file_path=file_path,
            mime_type="image/jpeg",
            file_size=16,
            sha256="original_hash_placeholder"
        )
        db.add(evidence)
        
        # Create ledger entry with different hash
        LedgerService.create_entry(
            db=db,
            entry_type=EntryType.EVIDENCE_REGISTERED.value,
            case_id="CASE-001",
            actor_id="U001",
            payload={"evidence_id": "EV-001", "sha256": "different_hash"},
            evidence_id="EV-001"
        )
        db.commit()
        
        # Verify - should detect tampering
        status, stored_hash, computed_hash = LedgerService.verify_evidence(db, "EV-001")
        assert status == "TAMPERED"
    finally:
        os.unlink(file_path)
