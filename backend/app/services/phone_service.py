import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.core.config import settings
from app.models import PhoneNumber, PersonPhone, CellTower, CallRecord, CDRImport, Case
from app.schemas.phone import (
    PhoneProfileResponse, MovementAnalysisResponse, NetworkAnalysisResponse,
    ColocationAnalysisResponse, BurnerDetectionResponse
)
from app.core.exceptions import NotFoundException, BadRequestException

logger = logging.getLogger("axiom.phone")

# Map of ISO region codes to dialing codes used when the phonenumbers library
# cannot validate a local number. Never emit a bogus prefix such as "+IN...".
REGION_DIALING_CODES = {
    "IN": "91", "US": "1", "CA": "1", "GB": "44", "AU": "61",
    "AE": "971", "SG": "65", "DE": "49", "FR": "33", "JP": "81",
}

class PhoneService:
    @staticmethod
    def normalize_phone(number: str) -> str:
        """Normalize phone number to E.164 format."""
        try:
            import phonenumbers
            parsed = phonenumbers.parse(number, settings.CDR_DEFAULT_REGION)
            if phonenumbers.is_valid_number(parsed):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception as e:
            logger.warning(f"Failed to normalize phone {number}: {e}")
        # Fallback: strip non-digits and add a REAL dialing code
        cleaned = ''.join(c for c in number if c.isdigit())
        if len(cleaned) == 10:
            dialing = REGION_DIALING_CODES.get(settings.CDR_DEFAULT_REGION, "91")
            return f"+{dialing}{cleaned}"
        if len(cleaned) == 11 and cleaned.startswith("0"):
            dialing = REGION_DIALING_CODES.get(settings.CDR_DEFAULT_REGION, "91")
            return f"+{dialing}{cleaned[1:]}"
        if len(cleaned) >= 8 and cleaned.isdigit():
            return f"+{cleaned}"
        return cleaned.strip()

    @staticmethod
    def _dialing_code_for(normalized: str) -> str:
        """Best-effort extract the '+' dialing code prefix from an E.164 number."""
        if normalized.startswith("+") and normalized[1:].isdigit():
            return normalized[1:]
        return REGION_DIALING_CODES.get(settings.CDR_DEFAULT_REGION, "91")

    @staticmethod
    def get_or_create_phone(db: Session, number: str) -> PhoneNumber:
        """Get existing phone or create new one."""
        normalized = PhoneService.normalize_phone(number)
        phone = db.query(PhoneNumber).filter(PhoneNumber.normalized == normalized).first()
        
        if not phone:
            phone = PhoneNumber(
                id=f"PN-{uuid.uuid4().hex[:8].upper()}",
                number=number,
                normalized=normalized,
                country_code=settings.CDR_DEFAULT_REGION
            )
            db.add(phone)
            db.commit()
            db.refresh(phone)
        else:
            phone.last_seen = datetime.now(timezone.utc)
            db.commit()
        
        return phone

    @staticmethod
    def import_cdr_csv(
        db: Session,
        case_id: str,
        file_path: str,
        operator: Optional[str] = None,
        uploaded_by: Optional[str] = None
    ) -> CDRImport:
        """Import CDR data from CSV file with column validation, error tracking, and duplicate detection.

        Raises NotFoundException when the target case does not exist (no implicit creation).
        """
        import csv
        import os as _os
        from datetime import datetime

        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise NotFoundException(message=f"Case {case_id} not found", code="CASE_NOT_FOUND")

        if _os.path.getsize(file_path) > settings.CDR_MAX_FILE_SIZE_MB * 1024 * 1024:
            raise BadRequestException(
                message=f"CDR file exceeds {settings.CDR_MAX_FILE_SIZE_MB}MB limit",
                code="CDR_FILE_TOO_LARGE"
            )

        # Create CDR import record
        cdr_import = CDRImport(
            id=f"CDR-{uuid.uuid4().hex[:8].upper()}",
            case_id=case_id,
            source_file=file_path,
            source_type="csv",
            operator=operator,
            status="PROCESSING",
            imported_by=uploaded_by
        )
        db.add(cdr_import)
        db.commit()

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = [fn.strip().lower() for fn in (reader.fieldnames or [])]

                # Validate required columns
                has_caller = any(col in fieldnames for col in ['caller', 'caller_number', 'calling_number', 'source'])
                has_called = any(col in fieldnames for col in ['called', 'called_number', 'destination', 'receiver', 'target'])
                has_time = any(col in fieldnames for col in ['start_time', 'timestamp', 'call_time', 'date_time', 'datetime', 'call_datetime', 'time'])

                if not has_caller:
                    raise BadRequestException(message="Missing required column: caller (or caller_number)", code="MISSING_CALLER_COLUMN")
                if not has_called:
                    raise BadRequestException(message="Missing required column: called (or called_number)", code="MISSING_CALLED_COLUMN")
                if not has_time:
                    raise BadRequestException(message="Missing required column: timestamp (or start_time)", code="MISSING_TIMESTAMP_COLUMN")

                records = []
                seen_pairs = set()
                skipped_sample = []
                total_rows = 0
                valid_rows = 0
                invalid_rows = 0
                duplicate_rows = 0

                # Cache normalized phones to avoid per-row DB round trips.
                phone_cache: Dict[str, PhoneNumber] = {}

                def _resolve_phone(number: str) -> PhoneNumber:
                    normalized = PhoneService.normalize_phone(number)
                    if normalized in phone_cache:
                        return phone_cache[normalized]
                    phone = db.query(PhoneNumber).filter(PhoneNumber.normalized == normalized).first()
                    if not phone:
                        phone = PhoneNumber(
                            id=f"PN-{uuid.uuid4().hex[:8].upper()}",
                            number=number,
                            normalized=normalized,
                            country_code=settings.CDR_DEFAULT_REGION
                        )
                        db.add(phone)
                        phone_cache[normalized] = phone
                    else:
                        phone_cache[normalized] = phone
                    return phone

                def _parse_time(start_time_str: str) -> Optional[datetime]:
                    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
                                "%Y/%m/%d %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
                        try:
                            clean_str = start_time_str.replace('Z', '').split('.')[0]
                            return datetime.strptime(clean_str, fmt)
                        except ValueError:
                            continue
                    try:
                        return datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                    except Exception:
                        return None

                for row_dict in reader:
                    total_rows += 1
                    if valid_rows >= settings.CDR_MAX_ROWS:
                        break

                    row = {k.strip().lower(): v.strip() for k, v in row_dict.items() if k and v}

                    caller = row.get('caller_number') or row.get('caller') or row.get('calling_number') or row.get('source')
                    called = row.get('called_number') or row.get('called') or row.get('destination') or row.get('receiver') or row.get('target')
                    call_type = row.get('call_type') or row.get('type') or 'outgoing'
                    start_time_str = (row.get('start_time') or row.get('timestamp') or row.get('call_time')
                                      or row.get('date_time') or row.get('datetime') or row.get('call_datetime')
                                      or row.get('time'))
                    if not start_time_str and row.get('date'):
                        # Split date + time columns into a single timestamp.
                        candidate = f"{row.get('date')} {row.get('time', '00:00:00')}"
                        if _parse_time(candidate):
                            start_time_str = candidate
                    duration = row.get('duration_seconds') or row.get('duration') or row.get('call_duration') or '0'
                    tower_id = row.get('tower_id') or row.get('cell_tower') or row.get('tower')
                    lat = row.get('latitude') or row.get('lat')
                    lon = row.get('longitude') or row.get('lon')
                    imsi = row.get('imsi')
                    imei = row.get('imei')

                    if not caller or not called or not start_time_str:
                        invalid_rows += 1
                        if len(skipped_sample) < 5:
                            skipped_sample.append({"row": total_rows, "reason": "missing caller/called/timestamp"})
                        continue

                    parsed_time = _parse_time(start_time_str)
                    if not parsed_time:
                        invalid_rows += 1
                        if len(skipped_sample) < 5:
                            skipped_sample.append({"row": total_rows, "reason": f"unparseable timestamp {start_time_str!r}"})
                        continue

                    # Duplicate detection: identical caller, receiver, and timestamp
                    dup_key = (caller, called, parsed_time.isoformat())
                    if dup_key in seen_pairs:
                        duplicate_rows += 1
                        continue
                    seen_pairs.add(dup_key)

                    caller_phone = _resolve_phone(caller)
                    called_phone = _resolve_phone(called)

                    record = CallRecord(
                        id=f"CR-{uuid.uuid4().hex[:8].upper()}",
                        cdr_import_id=cdr_import.id,
                        caller_number=caller,
                        caller_normalized=caller_phone.normalized,
                        called_number=called,
                        called_normalized=called_phone.normalized,
                        call_type=call_type.lower(),
                        start_time=parsed_time,
                        duration_seconds=int(float(duration)) if duration else 0,
                        tower_id=tower_id,
                        location_lat=float(lat) if lat else None,
                        location_lon=float(lon) if lon else None,
                        imsi=imsi,
                        imei=imei
                    )
                    records.append(record)
                    valid_rows += 1

                if phone_cache:
                    db.flush()
                if records:
                    db.add_all(records)
                    db.commit()

                cdr_import.total_records = total_rows
                cdr_import.valid_records = valid_rows
                cdr_import.invalid_records = invalid_rows
                cdr_import.duplicate_records = duplicate_rows
                cdr_import.status = "COMPLETED"

                # Update date range
                if records:
                    times = [r.start_time for r in records if r.start_time]
                    cdr_import.date_range_start = min(times)
                    cdr_import.date_range_end = max(times)

                db.commit()
                db.refresh(cdr_import)

        except BadRequestException:
            cdr_import.status = "FAILED"
            db.commit()
            raise
        except Exception as e:
            cdr_import.status = "FAILED"
            cdr_import.error_message = str(e)
            db.commit()
            raise BadRequestException(message=f"CDR import failed: {e}", code="CDR_IMPORT_FAILED")

        return cdr_import

    @staticmethod
    def get_phone_profile(db: Session, phone_number: str) -> PhoneProfileResponse:
        """Get comprehensive phone profile."""
        normalized = PhoneService.normalize_phone(phone_number)
        phone = db.query(PhoneNumber).filter(PhoneNumber.normalized == normalized).first()
        
        if not phone:
            raise NotFoundException(message=f"Phone {phone_number} not found", code="PHONE_NOT_FOUND")
        
        # Get associated people
        associations = db.query(PersonPhone).filter(PersonPhone.phone_id == phone.id).all()
        
        # Get call statistics
        caller_records = db.query(CallRecord).filter(CallRecord.caller_normalized == normalized).all()
        called_records = db.query(CallRecord).filter(CallRecord.called_normalized == normalized).all()
        all_records = caller_records + called_records
        
        total_calls = len(all_records)
        
        # Get unique contacts
        unique_numbers = set()
        for r in caller_records:
            unique_numbers.add(r.called_normalized)
        for r in called_records:
            unique_numbers.add(r.caller_normalized)
        unique_contacts = len(unique_numbers)
        
        # Get first and last call
        first_call = None
        last_call = None
        if all_records:
            times = [r.start_time for r in all_records if r.start_time]
            if times:
                first_call = min(times)
                last_call = max(times)
        
        # Get top contacts
        contact_counts = {}
        for r in caller_records:
            contact_counts[r.called_normalized] = contact_counts.get(r.called_normalized, 0) + 1
        for r in called_records:
            contact_counts[r.caller_normalized] = contact_counts.get(r.caller_normalized, 0) + 1
        
        top_contacts = sorted(
            [{'number': k, 'count': v} for k, v in contact_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:10]
        
        # Call pattern analysis
        call_pattern = {
            'incoming': len([r for r in called_records]),
            'outgoing': len([r for r in caller_records]),
            'avg_duration': sum([r.duration_seconds or 0 for r in all_records]) / total_calls if total_calls else 0
        }
        
        return PhoneProfileResponse(
            phone=phone,
            associated_people=associations,
            total_calls=total_calls,
            unique_contacts=unique_contacts,
            first_call=first_call,
            last_call=last_call,
            top_contacts=top_contacts,
            call_pattern=call_pattern
        )

    @staticmethod
    def analyze_movement(db: Session, phone_number: str) -> MovementAnalysisResponse:
        """Analyze phone movement patterns."""
        normalized = PhoneService.normalize_phone(phone_number)
        
        # Get all call records with location data
        records = db.query(CallRecord).filter(
            or_(
                CallRecord.caller_normalized == normalized,
                CallRecord.called_normalized == normalized
            ),
            CallRecord.location_lat.isnot(None),
            CallRecord.location_lon.isnot(None)
        ).all()
        
        locations = []
        for r in records:
            locations.append({
                'lat': r.location_lat,
                'lon': r.location_lon,
                'timestamp': r.start_time,
                'tower_id': r.tower_id
            })
        
        # Get frequent locations (simple clustering)
        location_counts = {}
        for loc in locations:
            key = (round(loc['lat'], 4), round(loc['lon'], 4))
            location_counts[key] = location_counts.get(key, 0) + 1
        
        frequent_locations = sorted(
            [{'lat': k[0], 'lon': k[1], 'count': v} for k, v in location_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:5]
        
        date_range = {}
        if records:
            times = [r.start_time for r in records if r.start_time]
            if times:
                date_range = {'start': min(times), 'end': max(times)}
        
        return MovementAnalysisResponse(
            phone_number=phone_number,
            locations=locations,
            total_locations=len(locations),
            date_range=date_range,
            frequent_locations=frequent_locations
        )

    @staticmethod
    def analyze_network(db: Session, phone_number: str) -> NetworkAnalysisResponse:
        """Analyze phone call network."""
        normalized = PhoneService.normalize_phone(phone_number)
        
        caller_records = db.query(CallRecord).filter(CallRecord.caller_normalized == normalized).all()
        called_records = db.query(CallRecord).filter(CallRecord.called_normalized == normalized).all()
        
        # Build contact frequency map
        contact_counts = {}
        for r in caller_records:
            contact_counts[r.called_normalized] = contact_counts.get(r.called_normalized, 0) + 1
        for r in called_records:
            contact_counts[r.caller_normalized] = contact_counts.get(r.caller_normalized, 0) + 1
        
        contacts = [{'number': k, 'count': v} for k, v in contact_counts.items()]
        
        # Analyze peak hours
        all_records = caller_records + called_records
        hour_counts = [0] * 24
        for r in all_records:
            if r.start_time:
                hour_counts[r.start_time.hour] += 1
        
        peak_hours = sorted(range(24), key=lambda h: hour_counts[h], reverse=True)[:5]
        
        return NetworkAnalysisResponse(
            phone_number=phone_number,
            total_contacts=len(contacts),
            contacts=contacts,
            call_frequency=contact_counts,
            peak_hours=peak_hours
        )

    @staticmethod
    def analyze_colocation(db: Session, phone_numbers: List[str]) -> ColocationAnalysisResponse:
        """Analyze co-location between multiple phones."""
        normalized_numbers = [PhoneService.normalize_phone(p) for p in phone_numbers]
        
        # Get all records for all phones
        all_records = []
        for norm in normalized_numbers:
            records = db.query(CallRecord).filter(
                or_(
                    CallRecord.caller_normalized == norm,
                    CallRecord.called_normalized == norm
                ),
                CallRecord.location_lat.isnot(None),
                CallRecord.location_lon.isnot(None)
            ).all()
            all_records.extend([(norm, r) for r in records])
        
        # Find co-locations (same tower within time window)
        colocations = []
        time_window = timedelta(minutes=30)
        
        for i, (phone1, rec1) in enumerate(all_records):
            for phone2, rec2 in all_records[i+1:]:
                if phone1 == phone2:
                    continue
                
                if rec1.tower_id and rec1.tower_id == rec2.tower_id:
                    time_diff = abs(rec1.start_time - rec2.start_time) if rec1.start_time and rec2.start_time else None
                    if time_diff and time_diff <= time_window:
                        colocations.append({
                            'phone1': phone1,
                            'phone2': phone2,
                            'tower_id': rec1.tower_id,
                            'timestamp': rec1.start_time,
                            'time_diff_seconds': time_diff.total_seconds()
                        })
        
        return ColocationAnalysisResponse(
            phone_numbers=phone_numbers,
            colocations=colocations,
            total_colocations=len(colocations)
        )

    @staticmethod
    def detect_burner(db: Session, phone_number: str) -> BurnerDetectionResponse:
        """Detect if phone is likely a burner phone."""
        normalized = PhoneService.normalize_phone(phone_number)
        phone = db.query(PhoneNumber).filter(PhoneNumber.normalized == normalized).first()
        
        if not phone:
            raise NotFoundException(message=f"Phone {phone_number} not found", code="PHONE_NOT_FOUND")
        
        indicators = []
        confidence = 0.0
        details = {}
        
        # Indicator 1: Short lifespan
        lifespan = (phone.last_seen - phone.first_seen).days if phone.first_seen and phone.last_seen else 0
        if lifespan < 30:
            indicators.append("Short lifespan (< 30 days)")
            confidence += 0.3
        details['lifespan_days'] = lifespan
        
        # Indicator 2: Low call volume
        caller_records = db.query(CallRecord).filter(CallRecord.caller_normalized == normalized).count()
        called_records = db.query(CallRecord).filter(CallRecord.called_normalized == normalized).count()
        total_calls = caller_records + called_records
        
        if total_calls < 50:
            indicators.append("Low call volume (< 50 calls)")
            confidence += 0.2
        details['total_calls'] = total_calls
        
        # Indicator 3: Limited unique contacts
        unique_numbers = set()
        records = db.query(CallRecord).filter(
            or_(
                CallRecord.caller_normalized == normalized,
                CallRecord.called_normalized == normalized
            )
        ).all()
        
        for r in records:
            if r.caller_normalized != normalized:
                unique_numbers.add(r.caller_normalized)
            if r.called_normalized != normalized:
                unique_numbers.add(r.called_normalized)
        
        if len(unique_numbers) < 5:
            indicators.append("Limited unique contacts (< 5)")
            confidence += 0.2
        details['unique_contacts'] = len(unique_numbers)
        
        # Indicator 4: No person association
        associations = db.query(PersonPhone).filter(PersonPhone.phone_id == phone.id).count()
        if associations == 0:
            indicators.append("No person association")
            confidence += 0.2
        details['person_associations'] = associations
        
        # Cap confidence at 1.0
        confidence = min(confidence, 1.0)
        is_burner = confidence >= 0.5
        
        return BurnerDetectionResponse(
            phone_number=phone_number,
            is_burner=is_burner,
            confidence=confidence,
            indicators=indicators,
            details=details
        )

    @staticmethod
    def get_case_phone_intelligence(db: Session, case_id: str) -> Dict[str, Any]:
        """Calculate complete phone intelligence, communication network, and burner indicators for a case."""
        imports = db.query(CDRImport).filter(CDRImport.case_id == case_id).all()
        import_ids = [imp.id for imp in imports]

        if not import_ids:
            return {
                "case_id": case_id,
                "summary": {
                    "total_records": 0,
                    "valid_records": 0,
                    "invalid_records": 0,
                    "duplicate_records": 0,
                    "unique_numbers": 0,
                    "total_duration_seconds": 0,
                    "date_range_start": None,
                    "date_range_end": None,
                    "total_imports": 0
                },
                "top_connected_numbers": [],
                "frequent_pairs": [],
                "time_patterns": [{"hour": h, "count": 0} for h in range(24)],
                "tower_analysis": [],
                "burner_indicators": [],
                "network_graph": {"nodes": [], "edges": []},
                "imports": []
            }

        # Query all call records for this case's imports
        records = db.query(CallRecord).filter(CallRecord.cdr_import_id.in_(import_ids)).all()

        total_valid = sum(imp.valid_records or len(records) for imp in imports)
        total_invalid = sum(imp.invalid_records or 0 for imp in imports)
        total_duplicate = sum(imp.duplicate_records or 0 for imp in imports)
        total_records = sum(imp.total_records or len(records) for imp in imports)

        unique_numbers_set = set()
        number_stats = {}
        pair_stats = {}
        hour_counts = [0] * 24
        tower_counts = {}
        imei_to_numbers = {}

        times = []
        total_duration = 0

        for r in records:
            c1 = r.caller_number
            c2 = r.called_number
            unique_numbers_set.add(c1)
            unique_numbers_set.add(c2)

            dur = r.duration_seconds or 0
            total_duration += dur

            if r.start_time:
                times.append(r.start_time)
                hour_counts[r.start_time.hour] += 1

            # Number stats
            for num, is_caller in [(c1, True), (c2, False)]:
                if num not in number_stats:
                    number_stats[num] = {
                        "number": num,
                        "total_calls": 0,
                        "outgoing": 0,
                        "incoming": 0,
                        "duration": 0,
                        "contacts": set(),
                        "first_seen": r.start_time,
                        "last_seen": r.start_time,
                        "imeis": set()
                    }
                ns = number_stats[num]
                ns["total_calls"] += 1
                if is_caller:
                    ns["outgoing"] += 1
                    ns["contacts"].add(c2)
                else:
                    ns["incoming"] += 1
                    ns["contacts"].add(c1)
                ns["duration"] += dur
                if r.start_time:
                    if ns["first_seen"] is None or r.start_time < ns["first_seen"]:
                        ns["first_seen"] = r.start_time
                    if ns["last_seen"] is None or r.start_time > ns["last_seen"]:
                        ns["last_seen"] = r.start_time
                if r.imei:
                    ns["imeis"].add(r.imei)
                    imei_to_numbers.setdefault(r.imei, set()).add(num)

            # Pair stats (unordered communication frequency)
            pair_key = tuple(sorted([c1, c2]))
            if pair_key not in pair_stats:
                pair_stats[pair_key] = {"caller": pair_key[0], "called": pair_key[1], "count": 0, "duration": 0}
            pair_stats[pair_key]["count"] += 1
            pair_stats[pair_key]["duration"] += dur

            # Tower stats
            if r.tower_id or (r.location_lat and r.location_lon):
                tid = r.tower_id or f"LOC-{round(r.location_lat, 3)}_{round(r.location_lon, 3)}"
                if tid not in tower_counts:
                    tower_counts[tid] = {
                        "tower_id": tid,
                        "latitude": r.location_lat,
                        "longitude": r.location_lon,
                        "calls": 0,
                        "unique_numbers": set()
                    }
                tower_counts[tid]["calls"] += 1
                tower_counts[tid]["unique_numbers"].add(c1)
                tower_counts[tid]["unique_numbers"].add(c2)

        # Build top connected numbers
        top_connected = []
        for num, ns in sorted(number_stats.items(), key=lambda x: x[1]["total_calls"], reverse=True)[:15]:
            top_connected.append({
                "number": num,
                "total_calls": ns["total_calls"],
                "outgoing": ns["outgoing"],
                "incoming": ns["incoming"],
                "total_duration": ns["duration"],
                "unique_contacts": len(ns["contacts"]),
                "first_seen": ns["first_seen"].isoformat() if ns["first_seen"] else None,
                "last_seen": ns["last_seen"].isoformat() if ns["last_seen"] else None,
            })

        # Build frequent pairs
        frequent_pairs = sorted(
            [{"caller": p["caller"], "called": p["called"], "count": p["count"], "total_duration": p["duration"]} for p in pair_stats.values()],
            key=lambda x: x["count"],
            reverse=True
        )[:15]

        # Burner Phone Indicators (Potential burner signals)
        burner_indicators = []
        for num, ns in number_stats.items():
            signals = []
            confidence = 0.0

            # Signal 1: Low contact diversity with high call volume
            if len(ns["contacts"]) <= 2 and ns["total_calls"] >= 3:
                signals.append(f"Low contact diversity ({len(ns['contacts'])} contacts for {ns['total_calls']} calls)")
                confidence += 0.35

            # Signal 2: Short active lifespan
            if ns["first_seen"] and ns["last_seen"]:
                lifespan_days = (ns["last_seen"] - ns["first_seen"]).total_seconds() / 86400
                if lifespan_days < 7 and ns["total_calls"] >= 2:
                    signals.append(f"Short active lifespan ({round(lifespan_days, 1)} days)")
                    confidence += 0.30

            # Signal 3: Shared IMEI across multiple numbers
            for imei in ns["imeis"]:
                shared_with = imei_to_numbers.get(imei, set()) - {num}
                if shared_with:
                    signals.append(f"Device identifier (IMEI: {imei}) shared with {len(shared_with)} other number(s)")
                    confidence += 0.35
                    break

            if signals:
                burner_indicators.append({
                    "phone_number": num,
                    "confidence": min(round(confidence, 2), 1.0),
                    "indicator_label": "Potential burner-phone indicator",
                    "signals": signals,
                    "total_calls": ns["total_calls"],
                    "contacts_count": len(ns["contacts"])
                })

        burner_indicators.sort(key=lambda x: x["confidence"], reverse=True)

        # Towers
        tower_list = []
        for t in tower_counts.values():
            tower_list.append({
                "tower_id": t["tower_id"],
                "latitude": t["latitude"],
                "longitude": t["longitude"],
                "call_count": t["calls"],
                "unique_numbers_count": len(t["unique_numbers"])
            })
        tower_list.sort(key=lambda x: x["call_count"], reverse=True)

        # Network graph
        nodes = []
        for num in list(unique_numbers_set)[:30]:
            ns = number_stats.get(num, {})
            nodes.append({
                "id": num,
                "label": num,
                "calls": ns.get("total_calls", 0),
                "contacts": len(ns.get("contacts", []))
            })
        edges = []
        for p in frequent_pairs[:40]:
            edges.append({
                "source": p["caller"],
                "target": p["called"],
                "weight": p["count"],
                "duration": p["total_duration"]
            })

        date_start = min(times).isoformat() if times else None
        date_end = max(times).isoformat() if times else None

        imports_data = []
        for imp in imports:
            imports_data.append({
                "id": imp.id,
                "source_file": imp.source_file,
                "operator": imp.operator,
                "total_records": imp.total_records,
                "valid_records": imp.valid_records or imp.total_records,
                "invalid_records": imp.invalid_records or 0,
                "duplicate_records": imp.duplicate_records or 0,
                "status": imp.status,
                "created_at": imp.created_at.isoformat() if imp.created_at else None
            })

        return {
            "case_id": case_id,
            "summary": {
                "total_records": total_records,
                "valid_records": total_valid,
                "invalid_records": total_invalid,
                "duplicate_records": total_duplicate,
                "unique_numbers": len(unique_numbers_set),
                "total_duration_seconds": total_duration,
                "date_range_start": date_start,
                "date_range_end": date_end,
                "total_imports": len(imports)
            },
            "top_connected_numbers": top_connected,
            "frequent_pairs": frequent_pairs,
            "time_patterns": [{"hour": h, "count": hour_counts[h]} for h in range(24)],
            "tower_analysis": tower_list[:20],
            "burner_indicators": burner_indicators[:10],
            "network_graph": {"nodes": nodes, "edges": edges},
            "imports": imports_data
        }
