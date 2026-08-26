"""Allowed node labels, relationship types, and property conventions."""

from typing import FrozenSet

# Labels stored in Neo4j. IDs are always the uniqueness key — never names.
NODE_LABELS: FrozenSet[str] = frozenset(
    {
        "Person",
        "Case",
        "Vehicle",
        "Location",
        "Organization",
        "Event",
        "Evidence",
        "Image",
        "Report",
    }
)

# Stored fact relationships only. Vague types (RELATED_TO, CONNECTED_TO) are
# not persisted; those ideas belong in scored investigative-lead APIs.
RELATIONSHIP_TYPES: FrozenSet[str] = frozenset(
    {
        "MET",
        "KNOWS",
        "CALLED",
        "TRANSFERRED_MONEY_TO",
        "USED",
        "OWNED_BY",
        "VISITED",
        "LOCATED_AT",
        "SEEN_AT",
        "INVOLVED_IN",
        "WORKS_FOR",
        "OCCURRED_AT",
        "PART_OF",
        "DOCUMENTS",
        "MENTIONS",
        "SUPPORTS",
        "DEPICTS",
        "ASSOCIATED_WITH",
    }
)

# Member 1 NLP label aliases → Neo4j labels
NLP_LABEL_MAP = {
    "PERSON": "Person",
    "PEOPLE": "Person",
    "CASE": "Case",
    "VEHICLE": "Vehicle",
    "LOCATION": "Location",
    "PLACE": "Location",
    "ORGANIZATION": "Organization",
    "ORG": "Organization",
    "EVENT": "Event",
    "EVIDENCE": "Evidence",
    "IMAGE": "Image",
    "REPORT": "Report",
    "DATE": None,  # dates are properties, not nodes
}

ID_PREFIX_TO_LABEL = {
    "P": "Person",
    "C": "Case",
    "V": "Vehicle",
    "L": "Location",
    "O": "Organization",
    "E": "Event",
    "EV": "Evidence",
    "IMG": "Image",
    "RPT": "Report",
}

# Person–Person
PERSON_PERSON = {"MET", "KNOWS", "CALLED", "TRANSFERRED_MONEY_TO"}
# Person–Vehicle
PERSON_VEHICLE = {"USED"}
VEHICLE_PERSON = {"OWNED_BY"}
# Person–Location
PERSON_LOCATION = {"VISITED", "LOCATED_AT", "SEEN_AT"}
# Entity–Case
INVOLVED_IN_SOURCES = {
    "Person",
    "Vehicle",
    "Organization",
    "Location",
    "Evidence",
    "Event",
}

# Relationship modeling notes (also in graph/README.md):
# VISITED     — dated presence at a place (preferred for temporal analysis)
# LOCATED_AT  — weaker / undated association with a place
# SEEN_AT     — presence supported by evidence or an image
# OWNED_BY    — Vehicle -> Person
# PART_OF     — Event -> Case
# DOCUMENTS   — Report -> Case
# MENTIONS    — Report -> entity extracted from that report
# SUPPORTS    — Evidence -> Case
# DEPICTS     — Image -> Evidence or Image -> entity
# ASSOCIATED_WITH — Person <-> Organization when WORKS_FOR is too strong
# OCCURRED_AT — Event -> Location
