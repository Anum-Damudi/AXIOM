from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, cases, reports, people, vehicles, locations,
    evidence, search, graph, analytics, timeline, dashboard, health
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(reports.router, prefix="", tags=["Reports"])
api_router.include_router(people.router, prefix="/people", tags=["People"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
api_router.include_router(evidence.router, prefix="", tags=["Evidence"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(graph.router, prefix="/graph", tags=["Graph"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(timeline.router, prefix="", tags=["Timeline"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(health.router, prefix="/health", tags=["Health"])
