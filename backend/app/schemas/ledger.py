from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class LedgerEntryResponse(BaseModel):
    id: str
    entry_type: str
    case_id: str
    evidence_id: Optional[str] = None
    actor_id: str
    payload: str
    payload_hash: str
    block_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LedgerBlockResponse(BaseModel):
    id: int
    index: int
    timestamp: datetime
    prev_hash: str
    merkle_root: str
    block_hash: str
    sealed_by: str
    anchor_tx: Optional[str] = None

    class Config:
        from_attributes = True

class CustodyTransferRequest(BaseModel):
    to_user_id: str = Field(..., description="ID of the user receiving custody")
    reason: Optional[str] = Field(None, description="Reason for transfer")

class CustodyTransferResponse(BaseModel):
    id: str
    evidence_id: str
    from_user_id: str
    to_user_id: str
    reason: Optional[str] = None
    transferred_at: datetime

    class Config:
        from_attributes = True

class ChainVerifyResponse(BaseModel):
    valid: bool
    broken_at: Optional[int] = Field(None, description="Block index where chain breaks, if any")
    message: str

class EvidenceVerifyResponse(BaseModel):
    evidence_id: str
    status: str = Field(..., description="INTACT, TAMPERED, or MISSING")
    stored_hash: Optional[str] = None
    computed_hash: Optional[str] = None
    message: str

class MerkleProofResponse(BaseModel):
    entry_id: str
    block_index: int
    proof: List[str] = Field(..., description="Sibling hashes for Merkle proof")
    valid: bool

class SealRequest(BaseModel):
    sealed_by: str = Field(..., description="ID of user sealing the block")

class CertificateResponse(BaseModel):
    evidence_id: str
    sha256: str
    block_index: int
    merkle_proof: List[str]
    custody_log: List[CustodyTransferResponse]
    timestamp: datetime
    certificate_data: str = Field(..., description="PDF certificate as base64")
