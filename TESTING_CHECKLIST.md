# AXIOM — Testing Checklist
Maintained by Member 6 (Data, Testing & Product Lead) & Member 4 (Backend Lead)

## 1. Dataset
- [x] Synthetic dataset generated (people, vehicles, locations, cases, relationships, case_reports)
- [x] Dataset reviewed by Member 1 (NLP) and Member 2 (Graph) for format fit
- [x] Database seeder (`python -m app.db.seed`) populates PostgreSQL & Neo4j idempotently

## 2. NLP Module (Member 1)
- [x] Entity extraction accuracy (people, vehicles, locations, dates)
- [x] Relationship extraction accuracy
- [x] Handles messy/incomplete case text & untrusted input validation
- [x] Output format matches what Graph module expects

## 3. Knowledge Graph (Member 2)
- [x] All entities load correctly into graph database
- [x] Relationships connect correctly
- [x] Centrality / "key person" detection works (`/api/v1/analytics/key-persons`)
- [x] Community/cluster detection works (`/api/v1/analytics/communities`)
- [x] Hidden-link detection works on test data (`/api/v1/analytics/hidden-links`)

## 4. Computer Vision / Evidence (Member 3)
- [x] Image evidence upload works with MIME & file size validation
- [x] Object/text detection on sample images
- [x] Evidence correctly linked to case ID

## 5. Backend (Member 4 - Lead)
- [x] All API endpoints respond correctly (`/auth`, `/cases`, `/reports`, `/people`, `/vehicles`, `/locations`, `/evidence`, `/search`, `/graph`, `/analytics`, `/timeline`, `/dashboard`, `/health`)
- [x] File upload works with secure storage abstraction
- [x] Authentication & RBAC works (JWT access tokens + Bcrypt hashing)
- [x] Search/filter APIs return correct results across all entities
- [x] Standard error handling contract (`success: false`, `error: { code, message }`)
- [x] Cross-Case Intelligence Engine (`GET /api/v1/cases/{case_id}/related-cases`)
- [x] Comprehensive `pytest` automated test suite passing

## 6. Frontend / Dashboard (Member 5)
- [ ] Dashboard loads without errors
- [ ] Network graph renders correctly (Cytoscape.js)
- [ ] Search bar works
- [ ] Timeline view works
- [ ] Evidence panel works

## 7. Integration
- [x] NLP output flows into Graph correctly
- [x] Graph data formatted for Cytoscape.js Frontend contract
- [x] End-to-end: upload case text -> see it appear in dashboard APIs

## 8. Demo Readiness
- [x] Demo story backed by dataset & cross-case connection engine
- [x] All team members know their part of the demo
- [x] Docker Compose multi-container setup ready (`docker-compose up`)