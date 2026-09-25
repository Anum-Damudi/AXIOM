import os
import uuid
import logging
import hashlib
import json
from typing import List, Tuple, Optional, Dict, Any
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import Evidence, Case, EvidenceSuggestion
from app.schemas.evidence import EvidenceResponse, BatchFileResult, BatchUploadResponse
from app.services.cv_service import CvService
from app.services.audit_service import AuditService
from app.services.ledger_service import LedgerService
from app.models.ledger import EntryType
from app.core.exceptions import NotFoundException, BadRequestException

logger = logging.getLogger("axiom.evidence")

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff",
    "application/pdf", "text/plain"
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
BATCH_MAX_FILES = 20
BATCH_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file for batch

# Magic bytes for file type validation
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89\x50\x4e\x47': 'image/png',
    b'\x52\x49\x46\x46': 'image/webp',  # RIFF...WEBP
    b'%PDF': 'application/pdf',
}

# Module-level convenience wrapper so both `EvidenceService.check_duplicate` and
# `from app.services.evidence_service import check_duplicate` work identically.
def check_duplicate(db: Session, sha256: str, perceptual_hash: Optional[str] = None):
    return EvidenceService.check_duplicate(db, sha256, perceptual_hash)

def validate_magic_bytes(data: bytes) -> Optional[str]:
    """Validate file type using magic bytes."""
    for magic, mime_type in MAGIC_BYTES.items():
        if data.startswith(magic):
            return mime_type
    return None

def compute_perceptual_hash(image_data: bytes) -> Optional[str]:
    """Compute perceptual hash for duplicate detection."""
    try:
        from PIL import Image
        import imagehash
        import io
        
        img = Image.open(io.BytesIO(image_data))
        phash = imagehash.phash(img)
        return str(phash)
    except ImportError:
        logger.warning("imagehash not installed, skipping perceptual hashing")
        return None
    except Exception as e:
        logger.error(f"Failed to compute perceptual hash: {e}")
        return None

def generate_thumbnail(image_data: bytes, evidence_id: str) -> Optional[str]:
    """Generate thumbnail for image evidence."""
    try:
        from PIL import Image
        import io
        
        img = Image.open(io.BytesIO(image_data))
        img.thumbnail((200, 200))
        
        thumbnail_dir = os.path.join(settings.UPLOAD_DIR, "thumbnails")
        os.makedirs(thumbnail_dir, exist_ok=True)
        
        thumbnail_path = os.path.join(thumbnail_dir, f"{evidence_id}_thumb.jpg")
        img.save(thumbnail_path, "JPEG")
        
        return thumbnail_path
    except ImportError:
        logger.warning("PIL not installed, skipping thumbnail generation")
        return None
    except Exception as e:
        logger.error(f"Failed to generate thumbnail: {e}")
        return None

def extract_exif(image_data: bytes) -> Optional[Dict[str, Any]]:
    """Extract EXIF metadata from image."""
    try:
        from PIL import Image
        import io
        
        img = Image.open(io.BytesIO(image_data))
        exif_data = img._getexif()
        
        if exif_data:
            # Convert to serializable format
            from PIL.ExifTags import TAGS
            exif_dict = {}
            for tag, value in exif_data.items():
                tag_name = TAGS.get(tag, tag)
                try:
                    exif_dict[str(tag_name)] = str(value)
                except Exception:
                    pass
            return exif_dict
    except ImportError:
        logger.warning("PIL not installed, skipping EXIF extraction")
        return None
    except Exception as e:
        logger.error(f"Failed to extract EXIF: {e}")
        return None
    
    return None

class EvidenceService:
    @staticmethod
    def upload_evidence(
        db: Session,
        case_id: str,
        file: Optional[UploadFile] = None,
        uploader_id: str = None,
        title: Optional[str] = None,
        evidence_type: Optional[str] = None,
        description: Optional[str] = None,
        date: Optional[str] = None,
        source: Optional[str] = None,
        status: Optional[str] = None,
        related_entity_id: Optional[str] = None,
    ) -> EvidenceResponse:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
        file_name = None
        file_path = None
        mime_type = None
        file_size = None
        sha256_hash = None
        perceptual_hash = None
        thumbnail_path = None
        exif_data_str = None

        if file is not None and hasattr(file, "filename") and file.filename:
            # File is provided
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            file_ext = os.path.splitext(file.filename)[1]
            safe_filename = f"{evidence_id}{file_ext}"
            target_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

            file_content = file.file.read()
            file_size = len(file_content)

            if file_size > MAX_FILE_SIZE_BYTES:
                raise BadRequestException(message="File size exceeds maximum 50MB limit.", code="FILE_TOO_LARGE")

            # Magic-byte validation (header type cannot be spoofed unlike the MIME form field).
            validated_mime = validate_magic_bytes(file_content)
            declared_mime = file.content_type
            if validated_mime is None:
                # Allow text/plain only if it does not begin with any known binary signature.
                if declared_mime == "text/plain" and not any(file_content.startswith(m) for m in MAGIC_BYTES):
                    validated_mime = "text/plain"
                else:
                    raise BadRequestException(
                        message="Invalid file type (magic bytes validation failed)",
                        code="INVALID_FILE_TYPE"
                    )
            if validated_mime not in ALLOWED_MIME_TYPES:
                raise BadRequestException(message=f"File type {validated_mime} not supported.", code="INVALID_FILE_TYPE")

            sha256_hash = hashlib.sha256(file_content).hexdigest()

            with open(target_path, "wb") as f:
                f.write(file_content)

            file_name = safe_filename
            file_path = target_path
            mime_type = validated_mime or declared_mime

            if mime_type and mime_type.startswith("image/"):
                thumbnail_path = generate_thumbnail(file_content, evidence_id)
                exif_dict = extract_exif(file_content)
                if exif_dict:
                    exif_data_str = json.dumps(exif_dict)
                perceptual_hash = compute_perceptual_hash(file_content)
        else:
            # Metadata-only evidence record
            if not title or not title.strip():
                raise BadRequestException(message="Evidence title is required when no file is uploaded.", code="TITLE_REQUIRED")

            canonical_data = {
                "case_id": case_id,
                "title": title.strip(),
                "evidence_type": evidence_type or "Other",
                "description": description or "",
                "date": date or "",
                "source": source or "",
                "status": status or "Pending",
                "related_entity_id": related_entity_id or ""
            }
            canonical_str = json.dumps(canonical_data, sort_keys=True, separators=(',', ':'))
            sha256_hash = hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

        evidence_title = (title or "").strip()
        if not evidence_title and file:
            evidence_title = file.filename

        evidence = Evidence(
            id=evidence_id,
            case_id=case_id,
            title=evidence_title,
            evidence_type=evidence_type or "Other",
            description=description,
            date=date,
            source=source or "Field Investigation",
            status=status or "Pending",
            related_entity_id=related_entity_id,
            file_name=file_name,
            file_path=file_path,
            mime_type=mime_type,
            file_size=file_size,
            uploaded_by=uploader_id or "Officer Investigator",
            analysis_status="PENDING",
            sha256=sha256_hash,
            perceptual_hash=perceptual_hash,
            thumbnail_path=thumbnail_path,
            exif_data=exif_data_str,
            current_custodian=uploader_id or "Officer Investigator"
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)

        # Create ledger entry for evidence registration
        LedgerService.create_entry(
            db=db,
            entry_type=EntryType.EVIDENCE_REGISTERED.value,
            case_id=case_id,
            actor_id=uploader_id or "Officer Investigator",
            payload={
                "evidence_id": evidence_id,
                "title": evidence_title,
                "evidence_type": evidence.evidence_type,
                "file_name": file_name,
                "sha256": sha256_hash,
                "source": source or "Field Investigation"
            },
            evidence_id=evidence_id
        )

        # Link related entity if provided
        if related_entity_id:
            try:
                from app.models.relationship import Relationship
                from app.services.graph_service import GraphService
                rel_id = f"R{uuid.uuid4().hex[:6].upper()}"
                rel = Relationship(
                    id=rel_id,
                    source=evidence_id,
                    target=related_entity_id,
                    type="EVIDENCE_OF",
                    confidence=1.0,
                    provenance=f"Evidence linked to entity in case {case_id}"
                )
                db.add(rel)
                db.commit()
                # Sync relationship to Neo4j if graph available
                GraphService.sync_relationship_to_graph(rel_id, evidence_id, related_entity_id, "EVIDENCE_OF")
            except Exception as re_err:
                logger.warning(f"Could not link evidence to related entity: {re_err}")

        # NLP processing on description if provided
        if description and len(description.strip()) > 15:
            try:
                from app.services.nlp_service import NlpService
                extracted_data = NlpService._extract_entities_and_relationships(description)
                validated_payload = NlpService._validate_and_normalize(extracted_data)
                NlpService._persist_nlp_results(db, case_id, validated_payload)
                logger.info(f"NLP entity extraction processed for evidence {evidence_id}")
            except Exception as nlp_err:
                logger.warning(f"NLP processing on evidence description skipped: {nlp_err}")

        # Trigger CV analysis if image file
        if mime_type and mime_type.startswith("image/"):
            try:
                CvService.analyze_evidence(db, evidence.id)
                db.refresh(evidence)
                
                LedgerService.create_entry(
                    db=db,
                    entry_type=EntryType.ANALYSIS_RUN.value,
                    case_id=case_id,
                    actor_id="system",
                    payload={
                        "evidence_id": evidence_id,
                        "analysis_type": "cv_analysis"
                    },
                    evidence_id=evidence_id
                )
            except Exception as e:
                logger.error(f"Automatic CV analysis failed for evidence {evidence.id}: {e}")

        AuditService.log_action(db, action="EVIDENCE_UPLOAD", user_id=uploader_id, resource_type="evidence", resource_id=evidence.id)

        return EvidenceResponse.model_validate(evidence)

    @staticmethod
    def get_case_evidence(db: Session, case_id: str, evidence_type: Optional[str] = None, search: Optional[str] = None) -> List[EvidenceResponse]:
        query = db.query(Evidence).filter(Evidence.case_id == case_id)
        if evidence_type and evidence_type != "All":
            query = query.filter(Evidence.evidence_type == evidence_type)
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    Evidence.title.ilike(term),
                    Evidence.description.ilike(term),
                    Evidence.source.ilike(term),
                    Evidence.evidence_type.ilike(term),
                    Evidence.related_entity_id.ilike(term)
                )
            )
        evidence_list = query.order_by(Evidence.created_at.desc()).all()
        return [EvidenceResponse.model_validate(e) for e in evidence_list]

    @staticmethod
    def get_evidence_by_id(db: Session, evidence_id: str) -> EvidenceResponse:
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise NotFoundException(message=f"Evidence {evidence_id} not found", code="EVIDENCE_NOT_FOUND")
        return EvidenceResponse.model_validate(evidence)

    @staticmethod
    def delete_evidence(db: Session, evidence_id: str, user_id: str = None):
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise NotFoundException(message=f"Evidence {evidence_id} not found", code="EVIDENCE_NOT_FOUND")

        if evidence.file_path and os.path.exists(evidence.file_path):
            try:
                os.remove(evidence.file_path)
            except Exception as e:
                logger.error(f"Failed to delete file from disk: {e}")

        if evidence.thumbnail_path and os.path.exists(evidence.thumbnail_path):
            try:
                os.remove(evidence.thumbnail_path)
            except Exception as e:
                logger.error(f"Failed to delete thumbnail from disk: {e}")

        db.delete(evidence)
        db.commit()

        AuditService.log_action(db, action="EVIDENCE_DELETE", user_id=user_id, resource_type="evidence", resource_id=evidence_id)

    @staticmethod
    def check_duplicate(db: Session, sha256: str, perceptual_hash: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """Check if evidence is a duplicate based on SHA-256 or perceptual hash."""
        # Exact SHA-256 match
        exact_match = db.query(Evidence).filter(Evidence.sha256 == sha256).first()
        if exact_match:
            return True, exact_match.id
        
        # Perceptual hash similarity check (if available)
        if perceptual_hash:
            try:
                import imagehash
                try:
                    target_hash = imagehash.hex_to_hash(perceptual_hash)
                except Exception:
                    logger.warning(f"Malformed perceptual hash ignored: {perceptual_hash!r}")
                    return False, None

                all_evidence = db.query(Evidence).filter(Evidence.perceptual_hash.isnot(None)).all()
                for ev in all_evidence:
                    if ev.perceptual_hash:
                        try:
                            ev_hash = imagehash.hex_to_hash(ev.perceptual_hash)
                            distance = target_hash - ev_hash
                            if distance <= settings.PERCEPTUAL_HASH_THRESHOLD:
                                return True, ev.id
                        except Exception:
                            continue
            except ImportError:
                pass
        
        return False, None

    @staticmethod
    def upload_batch(
        db: Session,
        case_id: str,
        files: List[UploadFile],
        uploader_id: str = None
    ) -> BatchUploadResponse:
        """Process batch upload of multiple evidence files."""
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")
        
        if len(files) > BATCH_MAX_FILES:
            raise BadRequestException(
                message=f"Maximum {BATCH_MAX_FILES} files allowed per batch",
                code="TOO_MANY_FILES"
            )
        
        results = []
        successful = 0
        failed = 0
        duplicates = 0
        
        for file in files:
            result = BatchFileResult(success=False, file_name=file.filename)
            
            try:
                # Read file content
                file_content = file.file.read()
                file_size = len(file_content)
                
                # Size validation
                if file_size > BATCH_MAX_FILE_SIZE:
                    result.error = f"File size exceeds {BATCH_MAX_FILE_SIZE // (1024*1024)}MB limit"
                    failed += 1
                    results.append(result)
                    continue
                
                # Magic byte validation
                validated_mime = validate_magic_bytes(file_content)
                if not validated_mime or validated_mime not in ALLOWED_MIME_TYPES:
                    result.error = "Invalid file type (magic bytes validation failed)"
                    failed += 1
                    results.append(result)
                    continue
                
                # Compute hashes
                sha256_hash = hashlib.sha256(file_content).hexdigest()
                perceptual_hash = compute_perceptual_hash(file_content) if validated_mime.startswith("image/") else None
                
                # Check for duplicates
                is_duplicate, duplicate_of = EvidenceService.check_duplicate(db, sha256_hash, perceptual_hash)
                if is_duplicate:
                    result.is_duplicate = True
                    result.duplicate_of = duplicate_of
                    result.error = f"Duplicate of evidence {duplicate_of}"
                    duplicates += 1
                    results.append(result)
                    continue
                
                # Create evidence
                evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
                file_ext = os.path.splitext(file.filename)[1]
                safe_filename = f"{evidence_id}{file_ext}"
                target_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

                # Save file
                os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                with open(target_path, "wb") as f:
                    f.write(file_content)
                
                # Generate thumbnail and extract EXIF for images
                thumbnail_path = None
                exif_data_dict = None
                if validated_mime.startswith("image/"):
                    thumbnail_path = generate_thumbnail(file_content, evidence_id)
                    exif_data_dict = extract_exif(file_content)
                
                evidence = Evidence(
                    id=evidence_id,
                    case_id=case_id,
                    title=file.filename,
                    file_name=safe_filename,
                    file_path=target_path,
                    mime_type=validated_mime,
                    file_size=file_size,
                    uploaded_by=uploader_id or "Officer Investigator",
                    analysis_status="PENDING",
                    sha256=sha256_hash,
                    perceptual_hash=perceptual_hash,
                    thumbnail_path=thumbnail_path,
                    exif_data=json.dumps(exif_data_dict) if exif_data_dict else None,
                    current_custodian=uploader_id or "Officer Investigator"
                )
                db.add(evidence)
                db.commit()
                db.refresh(evidence)
                
                # Create ledger entry
                LedgerService.create_entry(
                    db=db,
                    entry_type=EntryType.EVIDENCE_REGISTERED.value,
                    case_id=case_id,
                    actor_id=uploader_id or "Officer Investigator",
                    payload={
                        "evidence_id": evidence_id,
                        "file_name": safe_filename,
                        "file_size": file_size,
                        "mime_type": validated_mime,
                        "sha256": sha256_hash,
                        "perceptual_hash": perceptual_hash
                    },
                    evidence_id=evidence_id
                )
                
                # Run CV analysis for images
                if validated_mime.startswith("image/"):
                    try:
                        CvService.analyze_evidence(db, evidence.id)
                        db.refresh(evidence)

                        # Create suggestions only from genuine CV output (never fabricated).
                        if evidence.analysis_result:
                            try:
                                analysis = json.loads(evidence.analysis_result) if isinstance(evidence.analysis_result, str) else evidence.analysis_result
                                if analysis.get("processing_status") == "completed":
                                    import re as _re

                                    # Object-class suggestions (real YOLO detections)
                                    seen_classes = set()
                                    for obj in analysis.get("objects", []):
                                        class_name = obj.get("class") if isinstance(obj, dict) else obj
                                        if isinstance(class_name, str) and class_name not in seen_classes:
                                            seen_classes.add(class_name)
                                            db.add(EvidenceSuggestion(
                                                id=f"ES-{uuid.uuid4().hex[:8].upper()}",
                                                evidence_id=evidence_id,
                                                suggestion_type="OBJECT_MATCH",
                                                target_entity_type="object",
                                                confidence=int(round(obj.get("confidence", 0.85) * 100)) if isinstance(obj, dict) else 85,
                                                details={"object": class_name, "source": "cv_analysis"},
                                                status="PENDING_REVIEW"
                                            ))

                                    # License-plate candidates from genuine OCR text
                                    plate_re = _re.compile(r"^[A-Z]{2}\s?\d{1,2}[A-Z]{0,3}\s?\d{3,4}$")
                                    for txt in analysis.get("text", []):
                                        if isinstance(txt, dict):
                                            text = txt.get("text", "")
                                        else:
                                            text = str(txt)
                                        normalized = _re.sub(r"\s+", " ", text.strip().upper())
                                        if plate_re.match(normalized):
                                            db.add(EvidenceSuggestion(
                                                id=f"ES-{uuid.uuid4().hex[:8].upper()}",
                                                evidence_id=evidence_id,
                                                suggestion_type="PLATE_MATCH",
                                                target_entity_type="vehicle",
                                                confidence=int(round(txt.get("confidence", 0.9) * 100)) if isinstance(txt, dict) else 90,
                                                details={"plate": normalized, "source": "cv_ocr"},
                                                status="PENDING_REVIEW"
                                            ))

                                db.commit()
                            except Exception as e:
                                logger.error(f"Failed to create suggestions: {e}")

                        # Create ledger entry for analysis
                        LedgerService.create_entry(
                            db=db,
                            entry_type=EntryType.ANALYSIS_RUN.value,
                            case_id=case_id,
                            actor_id="system",
                            payload={"evidence_id": evidence_id, "analysis_type": "cv_analysis"},
                            evidence_id=evidence_id
                        )
                    except Exception as e:
                        logger.error(f"CV analysis failed for evidence {evidence.id}: {e}")
                
                result.success = True
                result.evidence_id = evidence_id
                successful += 1
                
            except Exception as e:
                result.error = str(e)
                failed += 1
                logger.error(f"Failed to process file {file.filename}: {e}")
            
            results.append(result)
        
        AuditService.log_action(
            db,
            action="EVIDENCE_BATCH_UPLOAD",
            user_id=uploader_id,
            resource_type="case",
            resource_id=case_id,
            details={"total": len(files), "successful": successful, "failed": failed, "duplicates": duplicates}
        )
        
        return BatchUploadResponse(
            case_id=case_id,
            total_files=len(files),
            successful=successful,
            failed=failed,
            duplicates=duplicates,
            results=results
        )

    @staticmethod
    def confirm_suggestion(
        db: Session,
        suggestion_id: str,
        user_id: str,
        reason: Optional[str] = None
    ) -> EvidenceSuggestion:
        """Confirm an evidence suggestion and create relationship."""
        from datetime import datetime, timezone
        from app.models import Relationship
        
        suggestion = db.query(EvidenceSuggestion).filter(EvidenceSuggestion.id == suggestion_id).first()
        if not suggestion:
            raise NotFoundException(message=f"Suggestion {suggestion_id} not found", code="SUGGESTION_NOT_FOUND")
        
        if suggestion.status != "PENDING_REVIEW":
            raise BadRequestException(message="Suggestion already reviewed", code="ALREADY_REVIEWED")
        
        # Update suggestion
        suggestion.status = "CONFIRMED"
        suggestion.reviewed_by = user_id
        suggestion.reviewed_at = datetime.now(timezone.utc)
        
        # Create relationship if target entity exists
        if suggestion.target_entity_id and suggestion.target_entity_type:
            existing_rel = db.query(Relationship).filter(
                Relationship.source == suggestion.evidence_id,
                Relationship.target == suggestion.target_entity_id
            ).first()
            
            if not existing_rel:
                relationship = Relationship(
                    id=f"REL-{uuid.uuid4().hex[:8].upper()}",
                    source=suggestion.evidence_id,
                    target=suggestion.target_entity_id,
                    type=f"SUGGESTED_{suggestion.suggestion_type}",
                    confidence=suggestion.confidence / 100.0 if suggestion.confidence else 0.85,
                    provenance="evidence_suggestion"
                )
                db.add(relationship)
        
        db.commit()
        db.refresh(suggestion)
        
        return suggestion

    @staticmethod
    def reject_suggestion(
        db: Session,
        suggestion_id: str,
        user_id: str,
        reason: Optional[str] = None
    ) -> EvidenceSuggestion:
        """Reject an evidence suggestion."""
        from datetime import datetime, timezone
        
        suggestion = db.query(EvidenceSuggestion).filter(EvidenceSuggestion.id == suggestion_id).first()
        if not suggestion:
            raise NotFoundException(message=f"Suggestion {suggestion_id} not found", code="SUGGESTION_NOT_FOUND")
        
        if suggestion.status != "PENDING_REVIEW":
            raise BadRequestException(message="Suggestion already reviewed", code="ALREADY_REVIEWED")
        
        suggestion.status = "REJECTED"
        suggestion.reviewed_by = user_id
        suggestion.reviewed_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(suggestion)
        
        return suggestion
