# NEXUS-CRIME — Knowledge Graph (Member 2)

Investigative assistance only. Graph analytics never determine guilt.

This module owns Neo4j schema, ingest from NLP/CV JSON, Cypher queries, network analytics, and hidden-link scoring. Member 4 mounts the FastAPI router. Member 5 consumes the JSON described in section L.

---

## A. Concept (simple language)

Investigators already collect facts: who met whom, which vehicle was used, where someone was seen, which case a person is named in.

The knowledge graph stores those **facts** as nodes (things) and relationships (recorded links). It does **not** decide that someone committed a crime.

On top of the facts, this module computes **investigative leads**:

- “These two cases share a vehicle.”
- “This person sits on many recorded paths.”
- “These people were recorded at the same place within a few days.”

Every lead is explainable: shared entities, a path of recorded relationships, dates, and a **potential link score**. Language in APIs is `potential connection`, `investigative lead`, `relationship detected`, `potential link score`.

**Fact vs inference**

| Kind | Stored in Neo4j? | Example |
|------|------------------|---------|
| Extracted fact | Yes | `P001 -[:MET {date:"2026-05-12"}]-> P002` |
| Inferred lead | No (computed on read) | C101 and C287 may be connected via V001 |

---

## B. Architecture

```
Member 1 NLP JSON ──┐
Member 3 Evidence JSON ─┼─► graph ingest ─► Neo4j (facts)
Member 6 seed JSON ───┘         │
                                ▼
                     graph_service / Cypher
                                │
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                  ▼
         queries           analytics          hidden_links
         (search, paths)   (NetworkX/GDS)     (potential link score)
              │                 │                  │
              └────────► FastAPI /graph/* ─────────┘
                                │
                                ▼
                    Member 4 backend + Member 5 UI
```

Neo4j is the system of record for entities and fact relationships. Analytics load a small undirected projection into NetworkX so the hackathon demo works **without** the GDS plugin. If GDS is installed later, the same algorithms can be switched to native GDS; the JSON contract stays the same.

---

## C–D. Graph schema (nodes and relationships)

Identity is always a stable ID (`P001`, `C101`, `V001`). Names are properties, never keys.

### Nodes

| Label | ID pattern | Required | Important optional properties | Constraint |
|-------|------------|----------|-------------------------------|------------|
| Person | `P###` | `id`, `name` | `age` int, `role` string (not a guilt label; use `person_of_interest`, `witness`, `associate`, `complainant`) | unique `id` |
| Case | `C###` | `id`, `title` | `date` `YYYY-MM-DD`, `status`, `summary` | unique `id` |
| Vehicle | `V###` | `id` | `plate_number`, `type`, `color` | unique `id`; index on plate |
| Location | `L###` | `id`, `name` | `lat`, `lng` float, `kind` | unique `id` |
| Organization | `O###` | `id`, `name` | `org_type` | unique `id` |
| Event | `E###` | `id`, `event_type` | `occurred_on`, `description` | unique `id`; index on `occurred_on` |
| Evidence | `EV###` | `id` | `evidence_type`, `description`, `case_id` | unique `id` |
| Image | `IMG###` | `id` | `path`, `captured_on`, `detected_objects`, `visible_text` | unique `id` |
| Report | `RPT###` | `id` | `report_text`, `case_id`, `extracted_at` | unique `id` |

**No Date nodes.** A calendar day is a property (`date`, `occurred_on`). Use an **Event** node when the happening itself must connect to a location, case, people, and evidence at once.

### Relationships we actually store

Vague types `RELATED_TO` and `CONNECTED_TO` are **not** stored. They hide meaning and mix facts with guesses.

| Type | From → To | When to use |
|------|-----------|-------------|
| `MET` | Person → Person | Explicit meeting in text or a statement |
| `KNOWS` | Person → Person | Longer-term association, weaker than MET |
| `CALLED` | Person → Person | Call / contact record |
| `TRANSFERRED_MONEY_TO` | Person → Person | Money movement record |
| `USED` | Person → Vehicle | Person used a vehicle on a date |
| `OWNED_BY` | Vehicle → Person or Organization | Ownership / fleet assignment |
| `VISITED` | Person → Location | Dated presence (preferred for time analysis) |
| `LOCATED_AT` | Person → Location | Weaker or less dated place association |
| `SEEN_AT` | Person → Location | Presence supported by evidence/image |
| `INVOLVED_IN` | Person/Vehicle/Org/Location/Evidence → Case | Named in a case file |
| `WORKS_FOR` | Person → Organization | Employment / affiliation |
| `OCCURRED_AT` | Event → Location | Where an event happened |
| `PART_OF` | Event → Case | Event belongs to a case |
| `DOCUMENTS` | Report → Case | Source report |
| `MENTIONS` | Report or Evidence → entity | Extraction / evidence mention |
| `SUPPORTS` | Evidence → Case | Evidence attached to a case |
| `DEPICTS` | Image → Evidence | Image file for that evidence |
| `ASSOCIATED_WITH` | Person → Organization | Affiliation weaker than WORKS_FOR |

**Relationship properties:** `rel_key` (dedupe), `date`, `confidence` (0–1), `source_module` (`nlp` \| `cv` \| `seed` \| `api`), `case_id`, `evidence_id`, `interpretation` (`extracted_fact`).

Dedup: `MERGE` on `(id)` for nodes and on `rel_key = source|TYPE|target|date` for relationships.

### Example: NLP sentence → graph

Text: *“Arun met Ravi near Bhatkal on 12 May using vehicle KA-47-AB-1234.”*

Member 1 JSON (see `graph/ingest_nlp.py` `EXAMPLE_NLP_PAYLOAD`):

- Entities: `P001` Person Arun, `P002` Person Ravi, `L001` Location Bhatkal, `V001` Vehicle plate, date as property `2026-05-12` (not a node).
- Facts: `P001-MET→P002`, `P001-USED→V001`, `P001-LOCATED_AT→L001`, plus `INVOLVED_IN` Case and `Report-MENTIONS→` each entity.

`POST /graph/ingest/nlp` runs `ingest_nlp()` which `MERGE`s those nodes and edges.

---

## E. Neo4j setup

```bash
docker compose up -d
copy .env.example .env
pip install -r requirements.txt
python -m graph setup
python -m graph seed
python -m graph serve
```

Browser: Neo4j `http://localhost:7474` (user `neo4j` / password `nexuscrime`). API docs: `http://localhost:8000/docs`.

Constraints live in `graph/schema.py`.

---

## F. Cypher examples

```cypher
MERGE (p:Person {id: $id})
ON CREATE SET p += $props, p.created_at = datetime()
ON MATCH SET p += $props, p.updated_at = datetime();

MATCH (a:Person {id: $sid}), (b:Person {id: $tid})
MERGE (a)-[r:MET {rel_key: $rel_key}]->(b)
SET r.date = $date, r.confidence = $confidence, r.interpretation = 'extracted_fact';

MATCH (c:Case {id: 'C101'})-[*1..2]-(n)
RETURN c, n;

MATCH (a {id: 'C101'}), (b {id: 'C287'})
MATCH path = shortestPath((a)-[*..6]-(b))
RETURN path;

MATCH (c:Case {id: 'C101'})<-[:INVOLVED_IN]-(n)-[:INVOLVED_IN]->(other:Case)
WHERE other.id <> c.id
RETURN labels(n)[0], n.id, collect(DISTINCT other.id);
```

---

## G. Python layout

| File | Responsibility |
|------|----------------|
| `connection.py` | Driver, sessions, JSON-safe query helpers |
| `schema.py` | Constraints and indexes |
| `models.py` | Allowed labels and relationship whitelist |
| `nodes.py` | Node MERGE / ensure |
| `relationships.py` | Relationship MERGE with `rel_key` |
| `queries.py` | Search, neighbors, shortest path, multi-hop, case subgraph |
| `analytics.py` | Degree, PageRank, betweenness, Louvain, components |
| `hidden_links.py` | Cross-case potential link score |
| `temporal.py` | Date parsing, proximity, timelines |
| `ingest_nlp.py` | Member 1 JSON → Neo4j |
| `ingest_evidence.py` | Member 3 JSON → Neo4j |
| `frontend_payload.py` | Member 5 graph JSON |
| `graph_service.py` | Facade |
| `router.py` / `app.py` | FastAPI |
| `seed_graph.py` | Loads `data/graph_seed.json` |
| `ethics.py` | Disclaimer strings |

---

## H. Graph analytics

Implemented in `graph/analytics.py` (NetworkX projection).

| Algorithm | What it does | Why here | Input | Output | Frontend |
|-----------|--------------|----------|-------|--------|----------|
| Degree centrality | Share of neighbors | Finds hubs in **recorded** links | Undirected graph | 0–1 per node | Node size (small) |
| PageRank | Importance via well-connected neighbors | Repeatedly appearing vehicles/places rise | Same | 0–1 | Node size |
| Betweenness | Fraction of shortest paths through a node | Bridge entities between clusters / cases | Same | 0–1 | Glow / rank list |
| Louvain | Dense clusters | Possible groups of recorded associations | Same | `community_id` | Node color |
| Connected components | Isolated islands | Shows disconnected control cases | Same | count + members | Separate components |
| Shortest path | Fewest hops | Explainable chain between two IDs | Two node IDs | path nodes/edges | Highlight path |
| Link prediction | Optional; **not enabled** | Easy to overclaim “they will connect” | — | — | Do not show as fact |

All algorithm payloads include `interpretation: inferred_potential_connection` and the disclaimer. Do not label high centrality as “key suspect.”

---

## I. Hidden-link detection

`GET /graph/hidden-links?case_id=C101`

Two cases may share people, vehicles, places, orgs, or evidence **without** a Case–Case edge.

**Potential link score (0–100), additive with a cap:**

- Shared person +22 (extra people of that type add 25% of the weight)
- Shared vehicle +20
- Shared location +12
- Shared organization +15
- Shared evidence +16
- Case dates within 14 days +10
- Short path bonus (decays with hops)
- Average relationship confidence on the path × 8

Response shape:

```json
{
  "case_a": "C101",
  "case_b": "C287",
  "potential_link_score": 87,
  "reasons": ["Shared person", "Shared vehicle", "Temporal proximity"],
  "path": ["C101", "P002", "V001", "C287"],
  "interpretation": "inferred_potential_connection",
  "label": "investigative_lead",
  "disclaimer": "Results are investigative leads only. ..."
}
```

Demo seed: **C101 ↔ C287 ↔ C204** share van `V001`; **C101 ↔ C110 ↔ C203** share Coastal Logistics `O001` / Arun.

---

## J. Temporal analysis

- **Relationship `date`** for simple facts (`VISITED`, `MET`, `USED`).
- **Event nodes** when one happening must link location + case + description + evidence.

`temporal.py` treats two dates as proximate if they are within `window_days` (default 14). Example: Arun at Bhatkal on 2026-05-12 and Ravi at Bhatkal bus stand on 2026-05-13 → temporal proximity lead, **not** proof they met on the 13th.

---

## K. FastAPI contract (Member 4)

Mount: `app.include_router(graph_router)` from `graph.router`.

| Method | Path | Body / query | Purpose |
|--------|------|----------------|---------|
| GET | `/graph/health` | — | Neo4j ping |
| POST | `/graph/setup` | — | Constraints |
| POST | `/graph/entities` | `{label, properties}` | Upsert node |
| POST | `/graph/relationships` | `{source_id, type, target_id, date?, confidence?}` | Upsert fact edge |
| POST | `/graph/ingest/nlp` | Member 1 payload | Text extract → graph |
| POST | `/graph/ingest/evidence` | Member 3 payload | CV → graph |
| GET | `/graph/search?q=` | `label?` | Search |
| GET | `/graph/entity/{id}` | — | One node |
| GET | `/graph/neighbors/{id}` | `depth` | Local graph |
| GET/POST | `/graph/path` | `source_id`, `target_id` | Shortest path |
| GET | `/graph/case/{id}` | `depth` | Frontend case graph |
| GET | `/graph/case/{id}/connections` | — | Cross-case + hidden links |
| GET | `/graph/case/{id}/timeline` | — | Events |
| GET | `/graph/analytics/centrality` | `case_id?` | Centrality |
| GET | `/graph/analytics/communities` | `case_id?` | Louvain |
| GET | `/graph/hidden-links` | `case_id`, `min_score` | Leads |

Errors: 400 validation, 404 missing entity, 503 Neo4j down.

---

## L. Frontend JSON (Member 5)

`GET /graph/case/C101` returns:

```json
{
  "case": {"id": "C101", "title": "...", "date": "2026-05-12", "status": "open"},
  "nodes": [
    {
      "id": "P001",
      "label": "Arun Sharma",
      "type": "Person",
      "properties": {},
      "degree_centrality": 0.12,
      "pagerank": 0.08,
      "community_id": 0,
      "highlighted": false
    }
  ],
  "edges": [
    {
      "id": "P001-MET-P002",
      "source": "P001",
      "target": "P002",
      "type": "MET",
      "label": "MET",
      "confidence": 0.91,
      "timestamp": "2026-05-12",
      "interpretation": "extracted_fact",
      "highlighted": false
    }
  ],
  "highlighted_path": [],
  "timeline": [],
  "disclaimer": "..."
}
```

Color by `type` or `community_id`. Size by `pagerank`. Dashed edges if you ever draw inferred links (this API does not emit inferred edges in `edges`; those appear only in hidden-link `path`).

---

## M. Synthetic dataset

`data/graph_seed.json` (fictional): 20 people, 10 vehicles, 15 locations, 10 cases, 3 organizations, events, evidence, reports.

Hidden connections designed for the demo: van `KA-47-AB-1234` (`V001`) on C101, C287, C204; Coastal Logistics (`O001`) on C101, C110, C203. Control case `C199` (Hubli bicycle) should not rank as a strong lead against C101.

---

## N. Folder structure

```
graph/           # this package
data/graph_seed.json
tests/test_graph_unit.py
docker-compose.yml
requirements.txt
```

---

## O. Testing

```bash
pytest
```

Unit tests cover IDs, temporal windows, NLP labels, and seed counts (no Neo4j). Integration: start Neo4j, seed, then `GET /graph/hidden-links?case_id=C101` and confirm C287 / C204 appear.

Manual Cypher in Browser: `MATCH (c:Case {id:'C101'})-[*1..2]-(n) RETURN c, n`.

---

## P. Demo scenario

1. Investigator opens **C101 Bhatkal roadside meeting**.
2. Graph shows Arun (`P001`), Ravi (`P002`), van `V001`, Bhatkal (`L001`), report and image evidence.
3. **Find related cases** → hidden-links API.
4. **C287** ranks high (shared person + shared vehicle + dates 12 vs 18 May). **C204** also (same van, 14 May checkpoint).
5. Path highlight e.g. `C101 → P002 → V001 → C287` or `C101 → V001 → C287`.
6. Reasons listed in plain language; disclaimer visible.
7. Timeline: meeting 12 May, bus stand 13 May, Ankola 14 May, warehouse 18 May.
8. Member 5 highlights that path; clicks open each entity via `/graph/entity/{id}`.

---

## Q. Common mistakes

- Using a name as the node key (duplicate “Ravi”, failed MERGE).
- Storing `CONNECTED_TO` as a fact.
- Writing hidden-link scores back as real edges.
- Calling a high PageRank node a suspect.
- Creating Date nodes for every day.
- Overwriting case titles on ingest (use `ensure_node`).
- Allowing arbitrary Cypher relationship types (SQL-injection-style); always whitelist.
- Treating `LOCATED_AT` without a date as a confirmed meeting.
- Linking every entity to every other entity “just in case” — the graph becomes noise.

---

## R. Member 2 checklist

- [x] Schema, constraints, indexes
- [x] Python driver + MERGE CRUD
- [x] NLP JSON ingest
- [x] Evidence JSON ingest
- [x] Search, neighbors, shortest path, multi-hop
- [x] Centrality + Louvain (NetworkX)
- [x] Hidden-link score + reasons + path
- [x] Temporal proximity + Event timeline
- [x] FastAPI router contract
- [x] Frontend graph JSON
- [x] Story-driven seed (C101 / C287)
- [x] Ethics language on analytics payloads
- [ ] Live Neo4j seed on the demo machine
- [ ] Joint test with Members 1, 4, 5
- [ ] Confirm GDS only if the plugin is installed (optional)

### Development order (done vs next)

Phases 1–9 and 10 (router) are implemented in code. Phase 11 is the JSON contract only. Phase 12: run Neo4j locally, seed, pytest, then tune scores with the team.
