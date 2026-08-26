# AXIOM — Testing Checklist
Maintained by Member 6 (Data, Testing & Product Lead)

## 1. Dataset
- [x] Synthetic dataset generated (people, vehicles, locations, cases, relationships, case_reports)
- [ ] Dataset reviewed by Member 1 (NLP) and Member 2 (Graph) for format fit
- [ ] Scale up dataset if needed (more cases/relationships)

## 2. NLP Module (Member 1)
- [ ] Entity extraction accuracy (people, vehicles, locations, dates)
- [ ] Relationship extraction accuracy
- [ ] Handles messy/incomplete case text
- [ ] Output format matches what Graph module expects

## 3. Knowledge Graph (Member 2)
- [x] Graph schema, constraints, and Python module in `graph/`
- [x] Story-driven seed (`data/graph_seed.json`) with hidden links C101–C287–C204
- [ ] Dataset reviewed by Member 1 (NLP) for ingest JSON fit
- [ ] All entities load correctly into a running Neo4j instance
- [ ] Relationships connect correctly after `python -m graph seed`
- [ ] Centrality / "key person" detection works (structural score only)
- [ ] Community/cluster detection works
- [ ] Hidden-link detection works on test data
- [ ] API mounted by Member 4 (`graph.router.graph_router`)

## 4. Computer Vision / Evidence (Member 3)
- [ ] Image upload works
- [ ] Object/text detection on sample images
- [ ] Evidence correctly linked to case ID

## 5. Backend (Member 4)
- [ ] All API endpoints respond correctly
- [ ] File upload works
- [ ] Authentication works
- [ ] Search/filter APIs return correct results
- [ ] Error handling (bad input, missing fields)

## 6. Frontend / Dashboard (Member 5)
- [ ] Dashboard loads without errors
- [ ] Network graph renders correctly
- [ ] Search bar works
- [ ] Timeline view works
- [ ] Evidence panel works

## 7. Integration
- [ ] NLP output flows into Graph correctly
- [ ] Graph data displays correctly on Frontend
- [ ] End-to-end: upload case text -> see it appear in dashboard

## 8. Demo Readiness
- [ ] Demo case/story finalized
- [ ] All team members know their part of the demo
- [ ] Backup plan if live demo fails (recorded video/screenshots)