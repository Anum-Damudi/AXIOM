import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas import ApiResponse
from app.schemas.ledger import (
    LedgerEntryResponse, LedgerBlockResponse, CustodyTransferRequest,
    CustodyTransferResponse, ChainVerifyResponse, EvidenceVerifyResponse,
    MerkleProofResponse, SealRequest
)
from app.services.ledger_service import LedgerService
from app.core.anchor import create_anchor
from app.core.config import settings

logger = logging.getLogger("axiom.ledger.api")

router = APIRouter()

@router.get("/blocks", response_model=ApiResponse[List[LedgerBlockResponse]], tags=["Ledger"])
def get_blocks(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get paginated list of ledger blocks."""
    from app.models import LedgerBlock
    blocks = db.query(LedgerBlock).order_by(LedgerBlock.index.desc()).offset(skip).limit(limit).all()
    return ApiResponse(success=True, data=[LedgerBlockResponse.model_validate(b) for b in blocks])

@router.get("/entries", response_model=ApiResponse[List[LedgerEntryResponse]], tags=["Ledger"])
def get_entries(
    skip: int = 0,
    limit: int = 100,
    case_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of ledger entries with optional case filtering."""
    from app.models import LedgerEntry
    query = db.query(LedgerEntry)
    if case_id:
        query = query.filter(LedgerEntry.case_id == case_id)
    entries = query.order_by(LedgerEntry.created_at.desc()).offset(skip).limit(limit).all()
    return ApiResponse(success=True, data=[LedgerEntryResponse.model_validate(e) for e in entries])

@router.get("/summary", response_model=ApiResponse[dict], tags=["Ledger"])
def get_ledger_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overall ledger chain integrity and block statistics."""
    from app.models import LedgerBlock, LedgerEntry
    valid, broken_at = LedgerService.verify_chain(db)
    total_blocks = db.query(LedgerBlock).count()
    total_entries = db.query(LedgerEntry).count()
    latest_block = db.query(LedgerBlock).order_by(LedgerBlock.index.desc()).first()
    return ApiResponse(
        success=True,
        data={
            "chain_valid": valid,
            "broken_at": broken_at,
            "total_blocks": total_blocks,
            "total_entries": total_entries,
            "latest_block_hash": latest_block.block_hash if latest_block else "0"*64,
            "latest_block_index": latest_block.index if latest_block else 0
        }
    )

@router.get("/verify", response_model=ApiResponse[ChainVerifyResponse], tags=["Ledger"])
def verify_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify the entire blockchain integrity."""
    valid, broken_at = LedgerService.verify_chain(db)
    
    if valid:
        return ApiResponse(success=True, data=ChainVerifyResponse(
            valid=True,
            message="Blockchain is valid and intact"
        ))
    else:
        return ApiResponse(success=True, data=ChainVerifyResponse(
            valid=False,
            broken_at=broken_at,
            message=f"Blockchain integrity broken at block {broken_at}"
        ))

@router.post("/seal", response_model=ApiResponse[LedgerBlockResponse], tags=["Ledger"])
def seal_block(
    request: SealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually seal unsealed entries into a new block (ADMIN only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN users can seal blocks"
        )
    
    block = LedgerService.seal_block(db, sealed_by=request.sealed_by)
    
    if not block:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unsealed entries to seal"
        )
    
    # Optionally anchor to blockchain
    try:
        anchor = create_anchor()
        tx_hash = anchor.anchor(block.block_hash, block.merkle_root)
        if tx_hash:
            block.anchor_tx = tx_hash
            db.commit()
            db.refresh(block)
    except Exception as e:
        logger.error(f"Failed to anchor block: {e}")
    
    return ApiResponse(success=True, data=LedgerBlockResponse.model_validate(block))

@router.get("/evidence/{evidence_id}/custody", response_model=ApiResponse[List[CustodyTransferResponse]], tags=["Ledger"])
def get_custody_timeline(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get chain-of-custody timeline for evidence."""
    timeline = LedgerService.get_custody_timeline(db, evidence_id)
    return ApiResponse(success=True, data=[CustodyTransferResponse(**t) for t in timeline])

@router.post("/evidence/{evidence_id}/custody/transfer", response_model=ApiResponse[CustodyTransferResponse], tags=["Ledger"])
def transfer_custody(
    evidence_id: str,
    request: CustodyTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transfer custody of evidence (INVESTIGATOR/ADMIN only)."""
    if current_user.role not in ["INVESTIGATOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only INVESTIGATOR and ADMIN users can transfer custody"
        )
    
    transfer = LedgerService.transfer_custody(
        db=db,
        evidence_id=evidence_id,
        from_user_id=current_user.id,
        to_user_id=request.to_user_id,
        reason=request.reason
    )
    
    return ApiResponse(success=True, data=CustodyTransferResponse.model_validate(transfer))

@router.get("/evidence/{evidence_id}/verify", response_model=ApiResponse[EvidenceVerifyResponse], tags=["Ledger"])
def verify_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify evidence integrity against ledger entry."""
    status, stored_hash, computed_hash = LedgerService.verify_evidence(db, evidence_id)
    
    return ApiResponse(success=True, data=EvidenceVerifyResponse(
        evidence_id=evidence_id,
        status=status,
        stored_hash=stored_hash,
        computed_hash=computed_hash,
        message=f"Evidence is {status.lower()}"
    ))

@router.get("/evidence/{evidence_id}/merkle-proof", response_model=ApiResponse[MerkleProofResponse], tags=["Ledger"])
def get_merkle_proof(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get Merkle proof for evidence's ledger entry."""
    from app.models import LedgerEntry
    from app.models.ledger import EntryType
    
    entry = db.query(LedgerEntry).filter(
        LedgerEntry.evidence_id == evidence_id,
        LedgerEntry.entry_type == EntryType.EVIDENCE_REGISTERED.value
    ).first()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence ledger entry not found"
        )
    
    proof, block_index = LedgerService.get_merkle_proof(db, entry.id)
    
    return ApiResponse(success=True, data=MerkleProofResponse(
        entry_id=entry.id,
        block_index=block_index,
        proof=proof,
        valid=len(proof) > 0
    ))

@router.post("/demo/tamper", response_model=ApiResponse[dict], tags=["Ledger"])
def demo_tamper(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """DEV-ONLY: Modify a stored file to demonstrate tamper detection."""
    if not getattr(settings, 'ENABLE_DEMO_TAMPER', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo tamper feature is disabled"
        )
    
    from app.models import Evidence
    
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found"
        )
    
    # Tamper with the file
    try:
        with open(evidence.file_path, "ab") as f:
            f.write(b"TAMPERED")
        
        logger.warning(f"Demo tamper applied to evidence {evidence_id}")
        return ApiResponse(success=True, data={
            "message": f"File {evidence_id} has been tampered with for demo purposes",
            "evidence_id": evidence_id,
            "file_path": evidence.file_path
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to tamper with file: {str(e)}"
        )
