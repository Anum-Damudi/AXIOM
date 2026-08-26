import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "nlp_output")

CASE_REPORTS_PATH = os.path.join(DATA_DIR, "case_reports.json")
PEOPLE_PATH = os.path.join(DATA_DIR, "people.json")
VEHICLES_PATH = os.path.join(DATA_DIR, "vehicles.json")
LOCATIONS_PATH = os.path.join(DATA_DIR, "locations.json")
RELATIONSHIPS_PATH = os.path.join(DATA_DIR, "relationships.json")
CASES_PATH = os.path.join(DATA_DIR, "cases.json")

EXTRACTIONS_OUTPUT_PATH = os.path.join(OUTPUT_DIR, "extractions.json")

PLATE_PATTERN = r"\b[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}\b"
DATE_PATTERN = r"\b\d{4}-\d{2}-\d{2}\b"
ORG_PATTERN = (
    r"\b(?:[A-Z][a-z]+ )+"
    r"(?:Inc|Corp|LLC|Ltd|Company|Agency|Department|Bureau|University|Bank)\b\.?"
)

TRIGGER_VERBS = {
    "met": "MET",
    "called": "CALLED",
    "contacted": "CALLED",
    "transferred": "TRANSFERRED_MONEY_TO",
}

LOCATION_PREPOSITIONS = ["near", "in", "at", "around"]
VEHICLE_TRIGGERS = ["using vehicle", "drove", "driving", "in vehicle"]
