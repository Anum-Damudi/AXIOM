import re

from . import config


class RelationExtractor:
    def __init__(self):
        self.location_preps = config.LOCATION_PREPOSITIONS
        self.vehicle_triggers = config.VEHICLE_TRIGGERS

    def extract(self, text, entities, case_id):
        relations = []
        relations.extend(self._extract_person_person(text, entities, case_id))
        relations.extend(self._extract_vehicle_usage(text, entities, case_id))
        relations.extend(self._extract_event_location(text, entities, case_id))
        return relations

    def _by_type(self, entities, etype):
        return [e for e in entities if e["type"] == etype]

    def _make(self, source, target, rtype, date, case_id):
        return {
            "source": source["id"],
            "target": target["id"],
            "type": rtype,
            "date": date["text"] if date else None,
            "case_id": case_id,
        }

    def _extract_person_person(self, text, entities, case_id):
        persons = self._by_type(entities, "PERSON")
        dates = self._by_type(entities, "DATE")
        date = dates[0] if dates else None
        verb_re = re.compile(
            r"\b(" + "|".join(config.TRIGGER_VERBS) + r")\b", re.IGNORECASE
        )
        relations = []
        for m in verb_re.finditer(text):
            before = [p for p in persons if p["end"] <= m.start()]
            after = [p for p in persons if p["start"] >= m.end()]
            if not before or not after:
                continue
            rtype = config.TRIGGER_VERBS[m.group(1).lower()]
            src = max(before, key=lambda p: p["end"])
            tgt = min(after, key=lambda p: p["start"])
            rel = self._make(src, tgt, rtype, date, case_id)
            if rel not in relations:
                relations.append(rel)
        return relations

    def _extract_vehicle_usage(self, text, entities, case_id):
        vehicles = self._by_type(entities, "VEHICLE")
        persons = self._by_type(entities, "PERSON")
        dates = self._by_type(entities, "DATE")
        date = dates[0] if dates else None
        trigger_re = re.compile(
            r"\b(" + "|".join(self.vehicle_triggers) + r")\b", re.IGNORECASE
        )
        relations = []
        for m in trigger_re.finditer(text):
            before = [p for p in persons if p["end"] <= m.start()]
            after = [v for v in vehicles if v["start"] >= m.end()]
            if not before or not after:
                continue
            src = max(before, key=lambda p: p["end"])
            tgt = min(after, key=lambda v: v["start"])
            rel = self._make(src, tgt, "USED", date, case_id)
            if rel not in relations:
                relations.append(rel)
        return relations

    def _extract_event_location(self, text, entities, case_id):
        locations = self._by_type(entities, "LOCATION")
        persons = self._by_type(entities, "PERSON")
        dates = self._by_type(entities, "DATE")
        date = dates[0] if dates else None
        prep_re = re.compile(
            r"\b(" + "|".join(self.location_preps) + r")\b", re.IGNORECASE
        )
        relations = []
        for m in prep_re.finditer(text):
            after = [l for l in locations if l["start"] >= m.end()]
            if not after:
                continue
            loc = min(after, key=lambda l: l["start"])
            subjects = [p for p in persons if p["end"] <= m.start()]
            if subjects:
                src = max(subjects, key=lambda p: p["end"])
            else:
                src = {"id": case_id}
            rel_type = "LOCATED_AT" if subjects else "OCCURRED_AT"
            rel = self._make(src, loc, rel_type, date, case_id)
            if rel not in relations:
                relations.append(rel)
        return relations
