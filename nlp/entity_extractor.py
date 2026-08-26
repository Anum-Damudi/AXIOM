import re

from . import config


class EntityExtractor:
    def __init__(self, gazetteer):
        self.gazetteer = gazetteer
        self.plate_re = re.compile(config.PLATE_PATTERN)
        self.date_re = re.compile(config.DATE_PATTERN)
        self.org_re = re.compile(config.ORG_PATTERN)
        self.person_names = sorted(
            (p["name"] for p in gazetteer.people), key=len, reverse=True
        )
        self.location_names = sorted(
            (l["name"] for l in gazetteer.locations), key=len, reverse=True
        )

    def extract(self, text):
        entities = []
        entities.extend(self._extract_persons(text))
        entities.extend(self._extract_vehicles(text))
        entities.extend(self._extract_locations(text))
        entities.extend(self._extract_dates(text))
        entities.extend(self._extract_orgs(text))
        return entities

    def _dedupe(self, entities):
        seen = set()
        result = []
        for e in entities:
            key = (e["type"], e["text"], e.get("id"))
            if key not in seen:
                seen.add(key)
                result.append(e)
        return result

    def _find_spans(self, text, names):
        spans = []
        for name in names:
            start = 0
            while True:
                idx = text.find(name, start)
                if idx == -1:
                    break
                end = idx + len(name)
                before_ok = idx == 0 or not text[idx - 1].isalnum()
                after_ok = end >= len(text) or not text[end].isalnum()
                if before_ok and after_ok:
                    spans.append((idx, end, name))
                start = idx + 1
        return spans

    def _extract_persons(self, text):
        results = []
        for _, end, name in self._find_spans(text, self.person_names):
            record = self.gazetteer.get_person(name)
            results.append(
                {
                    "text": name,
                    "type": "PERSON",
                    "start": _,
                    "end": end,
                    "id": record["id"] if record else None,
                }
            )
        return self._dedupe(results)

    def _extract_vehicles(self, text):
        results = []
        for m in self.plate_re.finditer(text):
            plate = m.group(0)
            record = self.gazetteer.get_vehicle(plate)
            results.append(
                {
                    "text": plate,
                    "type": "VEHICLE",
                    "start": m.start(),
                    "end": m.end(),
                    "id": record["id"] if record else None,
                }
            )
        return results

    def _extract_locations(self, text):
        results = []
        for _, end, name in self._find_spans(text, self.location_names):
            record = self.gazetteer.get_location(name)
            results.append(
                {
                    "text": name,
                    "type": "LOCATION",
                    "start": _,
                    "end": end,
                    "id": record["id"] if record else None,
                }
            )
        return self._dedupe(results)

    def _extract_dates(self, text):
        return [
            {
                "text": m.group(0),
                "type": "DATE",
                "start": m.start(),
                "end": m.end(),
                "id": None,
            }
            for m in self.date_re.finditer(text)
        ]

    def _extract_orgs(self, text):
        return [
            {
                "text": m.group(0).strip(),
                "type": "ORGANIZATION",
                "start": m.start(),
                "end": m.end(),
                "id": None,
            }
            for m in self.org_re.finditer(text)
        ]
