# AXIOM — NEXUS-CRIME
AI-Powered Criminal Network Analysis & Intelligence Platform

## Problem Statement
- **PS ID:** SIH26189
- **Title:** AI-Powered Criminal Network Analysis System
- **Category:** Software

## Team Roles & System Ownership
| Member | Role | Responsibility |
|--------|------|-----------------|
| Khamrunnisa Anjum | AI/NLP Lead | Entity & relationship extraction from case reports |
| Aysha Fakarde | Knowledge Graph & Analytics | Neo4j graph relationships & NetworkX analytics |
| Amal Khaleefa | Computer Vision & Evidence | Crime-scene evidence & image analysis |
| Anum | Backend & Integration Lead | FastAPI Orchestrator, Auth, PostgreSQL, Neo4j, AI Adapters, Search, Cross-Case Intelligence |
| Aruba | Frontend & Visualization | Investigator dashboard UI & Cytoscape.js graph |
| Ifra Safa | Data, Testing & Product | Synthetic dataset, QA testing, storyline & demo |

---

## Project Structure

```
AXIOM/
├── backend/                  # Enterprise FastAPI Orchestrator (Member 4)
│   ├── app/
│   │   ├── api/v1/          # Versioned REST APIs (Auth, Cases, Reports, People, Vehicles, Evidence, Graph, etc.)
│   │   ├── core/            # Config, Security (JWT/Bcrypt), DB, Neo4j, Middleware, Exceptions
│   │   ├── db/              # Seed script (populates Postgres & Neo4j from /data)
│   │   ├── models/          # SQLAlchemy ORM System of Record Models
│   │   ├── schemas/         # Pydantic v2 Request/Response Schemas
│   │   ├── services/        # Service Layer & Integration Adapters (NLP, CV, Graph, Cross-Case)
│   │   └── main.py          # FastAPI Main Entrypoint & Swagger Docs
│   ├── tests/               # Pytest Test Suite (Auth, Cases, Reports, Evidence, Search, Graph, Dashboard)
│   ├── Dockerfile           # Docker container file for Backend
│   ├── requirements.txt     # Python backend dependencies
│   └── .env                 # Environment configuration
├── data/                    # Synthetic investigation dataset
├── frontend/                # React Dashboard UI
└── docker-compose.yml       # Multi-container orchestration (Backend, PostgreSQL, Neo4j)
```

---

## Quickstart & Execution

### 1. Run Data Seeder
Populate PostgreSQL system of record and Neo4j graph database from `/data/*.json`:
```bash
cd backend
pip install -r requirements.txt
python -m app.db.seed
```

### 2. Start Backend Server
```bash
uvicorn app.main:app --reload --port 8000
```
Interactive OpenAPI Swagger Docs available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Run Test Suite
```bash
pytest -v
```

### 4. Docker Compose
```bash
docker-compose up --build
```

---

## Key Backend Capabilities
- **Intelligence Orchestration Gateway:** Router -> Service -> Model architecture with standard `{ success: true, data: ..., meta: ... }` response contract and custom error contract.
- **Cross-Case Intelligence Engine:** `GET /api/v1/cases/{case_id}/related-cases` automatically detects multi-hop shared entities (people, vehicles, locations) across distinct cases with explainable leads.
- **NLP Report Ingestion Pipeline:** Accepts raw text case reports, extracts entities & relationships, validates AI payloads, deduplicates entities, and synchronizes to Neo4j.
- **Computer Vision Evidence Storage:** Secure evidence file upload with MIME/size validation and object/OCR detection.
- **Network Analytics:** `GET /api/v1/analytics/key-persons`, `/communities`, `/hidden-links` powered by Neo4j & NetworkX centrality and community detection.
- **Unified Investigation Search:** `GET /api/v1/search?q=...` multi-domain search engine.
- **Case Timeline Aggregator:** Chronological event timeline aggregator per case.

## New Features (Phase A, B, C)

### Phase A: Evidence Ledger (Blockchain)
- **Immutable Evidence Ledger:** Append-only blockchain for evidence integrity with hash-chained blocks and Merkle tree sealing
- **SHA-256 Hashing:** Cryptographic file integrity verification for all uploaded evidence
- **Custody Transfer Tracking:** Complete audit trail of evidence custody changes
- **Blockchain Anchoring:** Optional Ethereum blockchain anchoring via web3.py for tamper-proof verification
- **Verification Endpoints:** Chain verification, evidence verification, and Merkle proof generation
- **Background Sealing:** Automatic periodic block sealing based on configurable thresholds

### Phase B: Multi-Image Evidence
- **Batch Upload:** Upload multiple evidence files simultaneously with duplicate detection
- **Magic Bytes Validation:** File type verification using binary signatures
- **Perceptual Hashing:** Image duplicate detection using imagehash library
- **Thumbnail Generation:** Automatic thumbnail creation for image evidence
- **EXIF Extraction:** Metadata extraction from images (GPS, camera info, timestamps)
- **Evidence Suggestions:** AI-generated suggestions from CV analysis (object matches, etc.)
- **Storage Backend Interface:** Pluggable storage backends (Local, S3)

### Phase C: Phone Intelligence
- **CDR Import:** Call Detail Record (CDR) CSV import with phone number normalization
- **Phone Profiling:** Comprehensive phone profiles with call statistics and associations
- **Movement Analysis:** Location tracking and movement pattern analysis from tower data
- **Network Analysis:** Call network analysis with contact frequency and peak hours
- **Co-location Detection:** Identify when multiple phones were at the same location
- **Burner Phone Detection:** Identify potential burner phones based on usage patterns
- **Neo4j Sync:** Automatic phone graph synchronization for network visualization

## New API Endpoints

### Ledger Endpoints
- `GET /api/v1/ledger/blocks` - List all ledger blocks
- `GET /api/v1/ledger/verify-chain` - Verify chain integrity
- `POST /api/v1/ledger/seal` - Manually trigger block sealing
- `POST /api/v1/ledger/custody/{evidence_id}` - Transfer evidence custody
- `GET /api/v1/ledger/evidence/{evidence_id}/verify` - Verify evidence integrity
- `GET /api/v1/ledger/evidence/{evidence_id}/merkle-proof` - Get Merkle proof

### Evidence Endpoints (Extended)
- `POST /api/v1/cases/{case_id}/evidence/batch` - Batch upload evidence
- `GET /api/v1/evidence/{evidence_id}/suggestions` - Get AI suggestions
- `POST /api/v1/suggestions/{suggestion_id}/action` - Confirm/reject suggestions

### Phone Endpoints
- `POST /api/v1/cases/{case_id}/cdr/import` - Import CDR data
- `GET /api/v1/phones/{phone_number}/profile` - Get phone profile
- `GET /api/v1/phones/{phone_number}/movement` - Analyze movement patterns
- `GET /api/v1/phones/{phone_number}/network` - Analyze call network
- `POST /api/v1/phones/colocation` - Analyze co-location
- `GET /api/v1/phones/{phone_number}/burner-detection` - Detect burner phones
- `GET /api/v1/phones/{phone_number}/graph` - Get Neo4j network graph
- `GET /api/v1/phones/{phone1}/path/{phone2}` - Find shortest call path