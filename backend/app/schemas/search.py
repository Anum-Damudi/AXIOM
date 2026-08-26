from typing import List, Dict, Any
from pydantic import BaseModel

class SearchCategorizedResults(BaseModel):
    cases: List[Dict[str, Any]] = []
    people: List[Dict[str, Any]] = []
    vehicles: List[Dict[str, Any]] = []
    locations: List[Dict[str, Any]] = []
    evidence: List[Dict[str, Any]] = []

class UnifiedSearchResponse(BaseModel):
    query: str
    total_matches: int
    results: SearchCategorizedResults
