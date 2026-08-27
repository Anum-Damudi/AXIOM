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

AXIOM/
├── data/              # Synthetic dataset + generator script (Ifra Safa)
├── frontend/          # Dashboard UI (Aruba)

(More folders will be added as NLP, graph, backend, and CV modules are built.)

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
🚧 In development — dataset complete, modules in progress.