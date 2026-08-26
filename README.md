# AXIOM — NEXUS-CRIME
AI-Powered Criminal Network Analysis & Intelligence Platform

## Problem Statement
- PS ID: SIH26189
- Title: AI-Powered Criminal Network Analysis System
- Category: Software

## Team
6-member team building an AI + Knowledge Graph + Network Analytics platform that turns scattered case data into a visual, searchable investigation tool.

## Team Roles
| Member | Role | Responsibility |
|--------|------|-----------------|
| Khamrunnisa Anjum | AI/NLP Lead | Extracts people, places, dates, relationships from case text |
| Aysha Fakarde | Knowledge Graph & Analytics | Graph database + network intelligence (Neo4j) |
| Amal Khaleefa | Computer Vision & Evidence | Crime-scene image / evidence analysis |
| Anum | Backend & Integration | APIs, authentication, connects all modules |
| Aruba | Frontend & Visualization | Investigator dashboard + interactive graph |
| Ifra Safa | Data, Testing & Product | Synthetic dataset, testing, documentation, demo |

## Project Structure

```
AXIOM/
├── data/                 # Synthetic datasets (Member 6 + graph seed)
│   ├── generate_data.py
│   └── graph_seed.json   # Story-driven graph used by Member 2
├── graph/                # Knowledge graph & network intelligence (Aysha)
├── tests/
├── docker-compose.yml    # Neo4j
└── frontend/             # Dashboard UI (Aruba) — not in repo yet
```

## Knowledge graph (Member 2)

Neo4j schema, ingest, Cypher queries, centrality/communities, and hidden-link scoring live in `graph/`. See `graph/README.md`.

```bash
docker compose up -d
pip install -r requirements.txt
python -m graph setup
python -m graph seed
python -m graph serve
```

Analytics are investigative leads only. They do not determine guilt.

## Dataset
Located in /data. Generated using generate_data.py (Python, requires faker).

Run it with:
pip install faker
python generate_data.py

Produces:
- people.json
- vehicles.json
- locations.json
- cases.json
- relationships.json
- case_reports.json

## Tech Stack
Python, FastAPI, React, Neo4j, PostgreSQL, NLP/Transformers, NetworkX, Cytoscape.js, Docker

## Status
🚧 In progress — synthetic data exists; knowledge graph module is implemented (needs a running Neo4j for live demo). NLP, CV, and frontend modules still to land.