import json
import os
import hashlib
import logging
import uuid
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import LedgerEntry, LedgerBlock, CustodyTransfer, Evidence
from app.models.ledger import EntryType
from app.core.config import settings
from app.core.exceptions import NotFoundException, BadRequestException

logger = logging.getLogger("axiom.ledger")

class LedgerService:
    @staticmethod
    def canonical_json(payload: Dict[str, Any]) -> str:
        """Serialize JSON with sorted keys and no whitespace for consistent hashing."""
        return json.dumps(payload, sort_keys=True, separators=(',', ':'))

    @staticmethod
    def sha256_hash(data: str) -> str:
        """Compute SHA-256 hash of a string."""
        return hashlib.sha256(data.encode()).hexdigest()

    @staticmethod
    def compute_merkle_root(hashes: List[str]) -> str:
        """Compute Merkle root from a list of hashes."""
        if not hashes:
            return LedgerService.sha256_hash("")
        
        if len(hashes) == 1:
            return hashes[0]
        
        while len(hashes) > 1:
            if len(hashes) % 2 == 1:
                hashes.append(hashes[-1])
            
            new_level = []
            for i in range(0, len(hashes), 2):
                combined = hashes[i] + hashes[i + 1]
                new_level.append(LedgerService.sha256_hash(combined))
            hashes = new_level
        
        return hashes[0]

    @staticmethod
    def create_entry(
        db: Session,
        entry_type: str,
        case_id: str,
        actor_id: str,
        payload: Dict[str, Any],
        evidence_id: Optional[str] = None
    ) -> LedgerEntry:
        """Create a new ledger entry."""
        canonical_payload = LedgerService.canonical_json(payload)
        payload_hash = LedgerService.sha256_hash(canonical_payload)
        
        entry = LedgerEntry(
            id=f"LE-{uuid.uuid4().hex[:8].upper()}",
            entry_type=entry_type,
            case_id=case_id,
            evidence_id=evidence_id,
            actor_id=actor_id,
            payload=canonical_payload,
            payload_hash=payload_hash,
            block_id=None
        )
        
        db.add(entry)
        db.commit()
        db.refresh(entry)
        
        logger.info(f"Created ledger entry {entry.id} of type {entry_type}")
        return entry

    @staticmethod
    def seal_block(db: Session, sealed_by: str) -> Optional[LedgerBlock]:
        """Collect unsealed entries and seal them into a new block."""
        unsealed_entries = db.query(LedgerEntry).filter(
            LedgerEntry.block_id.is_(None)
        ).order_by(LedgerEntry.created_at).all()
        
        if not unsealed_entries:
            logger.info("No unsealed entries to seal")
            return None
        
        # Get previous block
        prev_block = db.query(LedgerBlock).order_by(LedgerBlock.index.desc()).first()
        
        # Compute block index
        new_index = (prev_block.index + 1) if prev_block else 0
        
        # Compute Merkle root from entry hashes
        entry_hashes = [e.payload_hash for e in unsealed_entries]
        merkle_root = LedgerService.compute_merkle_root(entry_hashes)
        
        # Compute previous hash
        prev_hash = prev_block.block_hash if prev_block else "0" * 64
        
        # Compute block hash
        block_data = f"{new_index}{prev_hash}{merkle_root}{sealed_by}"
        block_hash = LedgerService.sha256_hash(block_data)
        
        # Create block
        block = LedgerBlock(
            index=new_index,
            prev_hash=prev_hash,
            merkle_root=merkle_root,
            block_hash=block_hash,
            sealed_by=sealed_by
        )
        
        db.add(block)
        db.flush()
        
        # Link entries to block
        for entry in unsealed_entries:
            entry.block_id = block.id
        
        db.commit()
        db.refresh(block)
        
        logger.info(f"Sealed block {block.index} with {len(unsealed_entries)} entries")
        return block

    @staticmethod
    def verify_chain(db: Session) -> Tuple[bool, Optional[int]]:
        """Verify the entire blockchain. Returns (valid, broken_index)."""
        blocks = db.query(LedgerBlock).order_by(LedgerBlock.index).all()
        
        if not blocks:
            return True, None
        
        # Verify genesis block
        genesis = blocks[0]
        if genesis.index != 0 or genesis.prev_hash != "0" * 64:
            return False, genesis.index
        
        # Verify chain linkage
        for i in range(1, len(blocks)):
            prev_block = blocks[i - 1]
            curr_block = blocks[i]
            
            if curr_block.prev_hash != prev_block.block_hash:
                return False, curr_block.index
            
            # Recompute block hash
            block_data = f"{curr_block.index}{curr_block.prev_hash}{curr_block.merkle_root}{curr_block.sealed_by}"
            computed_hash = LedgerService.sha256_hash(block_data)
            
            if computed_hash != curr_block.block_hash:
                return False, curr_block.index
        
        # Verify Merkle roots
        for block in blocks:
            entries = db.query(LedgerEntry).filter(
                LedgerEntry.block_id == block.id
            ).order_by(LedgerEntry.created_at).all()
            
            if entries:
                entry_hashes = [e.payload_hash for e in entries]
                computed_merkle = LedgerService.compute_merkle_root(entry_hashes)
                
                if computed_merkle != block.merkle_root:
                    return False, block.index
        
        return True, None

    @staticmethod
    def verify_evidence(db: Session, evidence_id: str) -> Tuple[str, Optional[str], Optional[str]]:
        """Verify evidence integrity against ledger. Returns (status, stored_hash, computed_hash)."""
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            return "MISSING", None, None
        
        # Find EVIDENCE_REGISTERED entry
        entry = db.query(LedgerEntry).filter(
            LedgerEntry.evidence_id == evidence_id,
            LedgerEntry.entry_type == EntryType.EVIDENCE_REGISTERED.value
        ).first()
        
        if not entry:
            return "MISSING", evidence.sha256, None

        # Extract registered SHA-256 hash
        stored_hash = evidence.sha256
        if not stored_hash and entry.payload:
            try:
                payload_dict = json.loads(entry.payload)
                stored_hash = payload_dict.get("sha256")
            except Exception:
                stored_hash = entry.payload_hash

        computed_hash = None
        try:
            if evidence.file_path and os.path.exists(evidence.file_path):
                with open(evidence.file_path, "rb") as f:
                    file_content = f.read()
                computed_hash = hashlib.sha256(file_content).hexdigest()
            else:
                # Metadata-only evidence re-calculation
                canonical_data = {
                    "case_id": evidence.case_id,
                    "title": (evidence.title or "").strip(),
                    "evidence_type": evidence.evidence_type or "Other",
                    "description": evidence.description or "",
                    "date": evidence.date or "",
                    "source": evidence.source or "",
                    "status": evidence.status or "Pending",
                    "related_entity_id": evidence.related_entity_id or ""
                }
                canonical_str = json.dumps(canonical_data, sort_keys=True, separators=(',', ':'))
                computed_hash = hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

            if computed_hash and stored_hash and computed_hash == stored_hash:
                return "INTACT", stored_hash, computed_hash
            else:
                return "TAMPERED", stored_hash, computed_hash
        except Exception as e:
            logger.error(f"Error computing evidence hash: {e}")
            return "MISSING", stored_hash, None

    @staticmethod
    def get_merkle_proof(db: Session, entry_id: str) -> Tuple[List[str], int]:
        """Get Merkle proof for a specific entry. Returns (proof_siblings, block_index)."""
        entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
        if not entry or not entry.block_id:
            return [], -1
        
        block = db.query(LedgerBlock).filter(LedgerBlock.id == entry.block_id).first()
        if not block:
            return [], -1
        
        # Get all entries in the block
        all_entries = db.query(LedgerEntry).filter(
            LedgerEntry.block_id == block.id
        ).order_by(LedgerEntry.created_at).all()
        
        # Find entry position
        entry_hashes = [e.payload_hash for e in all_entries]
        try:
            index = entry_hashes.index(entry.payload_hash)
        except ValueError:
            return [], block.index
        
        # Build Merkle proof
        proof = []
        current_level = entry_hashes[:]
        
        while len(current_level) > 1:
            if len(current_level) % 2 == 1:
                current_level.append(current_level[-1])
            
            sibling_index = index + 1 if index % 2 == 0 else index - 1
            proof.append(current_level[sibling_index])
            
            # Move to next level
            index = index // 2
            new_level = []
            for i in range(0, len(current_level), 2):
                combined = current_level[i] + current_level[i + 1]
                new_level.append(LedgerService.sha256_hash(combined))
            current_level = new_level
        
        return proof, block.index

    @staticmethod
    def get_custody_timeline(db: Session, evidence_id: str) -> List[Dict[str, Any]]:
        """Get ordered chain-of-custody entries for evidence."""
        transfers = db.query(CustodyTransfer).filter(
            CustodyTransfer.evidence_id == evidence_id
        ).order_by(CustodyTransfer.transferred_at).all()
        
        timeline = []
        for transfer in transfers:
            timeline.append({
                "id": transfer.id,
                "from_user_id": transfer.from_user_id,
                "to_user_id": transfer.to_user_id,
                "reason": transfer.reason,
                "transferred_at": transfer.transferred_at
            })
        
        return timeline

    @staticmethod
    def transfer_custody(
        db: Session,
        evidence_id: str,
        from_user_id: str,
        to_user_id: str,
        reason: Optional[str] = None
    ) -> CustodyTransfer:
        """Transfer custody of evidence."""
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise NotFoundException(message=f"Evidence {evidence_id} not found", code="EVIDENCE_NOT_FOUND")
        
        # Create custody transfer record
        transfer = CustodyTransfer(
            id=f"CT-{uuid.uuid4().hex[:8].upper()}",
            evidence_id=evidence_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            reason=reason
        )
        
        db.add(transfer)
        
        # Update evidence current custodian
        evidence.current_custodian = to_user_id
        
        # Create ledger entry
        LedgerService.create_entry(
            db=db,
            entry_type=EntryType.CUSTODY_TRANSFER.value,
            case_id=evidence.case_id,
            actor_id=from_user_id,
            payload={
                "evidence_id": evidence_id,
                "from_user_id": from_user_id,
                "to_user_id": to_user_id,
                "reason": reason
            },
            evidence_id=evidence_id
        )
        
        db.commit()
        db.refresh(transfer)
        
        logger.info(f"Transferred custody of {evidence_id} from {from_user_id} to {to_user_id}")
        return transfer

    @staticmethod
    def create_genesis_block(db: Session) -> LedgerBlock:
        """Create the genesis block if none exists."""
        existing = db.query(LedgerBlock).first()
        if existing:
            return existing
        
        genesis = LedgerBlock(
            index=0,
            prev_hash="0" * 64,
            merkle_root=LedgerService.sha256_hash(""),
            block_hash=LedgerService.sha256_hash(f"0{'0'*64}{'0'*64}genesis"),
            sealed_by="system"
        )
        
        db.add(genesis)
        db.commit()
        db.refresh(genesis)
        
        logger.info("Created genesis block")
        return genesis
