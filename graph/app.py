"""Runnable graph API for local demo. Member 4 can mount graph.router.graph_router instead."""

from fastapi import FastAPI

from graph.ethics import INVESTIGATIVE_DISCLAIMER
from graph.router import graph_router

app = FastAPI(
    title="NEXUS-CRIME Graph Intelligence",
    description=INVESTIGATIVE_DISCLAIMER,
    version="0.1.0",
)
app.include_router(graph_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "nexus-crime-graph",
        "docs": "/docs",
        "disclaimer": INVESTIGATIVE_DISCLAIMER,
    }
