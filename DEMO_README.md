# AXIOM Graph Demo

This guide covers the Neo4j and graph API portion of the AXIOM demo. The data is synthetic and all graph analytics are investigative leads, not findings of guilt.

## Prerequisites

- Docker Desktop with Docker Compose
- Python 3.11 or newer
- Dependencies installed from `requirements.txt`

## Start Neo4j

From the repository root:

```powershell
copy .env.example .env
docker compose up -d
```

Neo4j Browser is available at `http://localhost:7474` with:

- Username: `neo4j`
- Password: `nexuscrime`
- Bolt address: `bolt://localhost:7687`

Wait until the container health check is healthy before continuing.

## Install Python dependencies

```powershell
python -m pip install -r requirements.txt
```

## Apply schema and seed the graph

```powershell
python -m graph setup
python -m graph seed
```

The seed contains the primary demo case `C101`, related cases `C287` and `C204`, and the shared vehicle `V001` (`KA-47-AB-1234`). Re-running the seed is supported because nodes and relationships use `MERGE`.

## Start the API

In a second terminal:

```powershell
python -m graph serve
```

Open the API documentation at `http://localhost:8000/docs`.

## Run the graph smoke test

With Neo4j seeded and the API running:

```powershell
python scripts/graph_smoke_test.py
```

Use a different API address when needed:

```powershell
python scripts/graph_smoke_test.py --base-url http://localhost:8001
```

The smoke test verifies:

- API health reports Neo4j as connected
- `C101` exists and has graph nodes and edges
- the case timeline is populated
- hidden-link results include `C287` and `C204`
- the hidden-link response uses investigative-lead language

## Useful demo endpoints

- `GET /graph/health`
- `GET /graph/case/C101`
- `GET /graph/case/C101/timeline`
- `GET /graph/hidden-links?case_id=C101`
- `GET /graph/path?source_id=C101&target_id=C287`
- `GET /graph/analytics/centrality?case_id=C101`
- `GET /graph/analytics/communities?case_id=C101`

## Stop Neo4j

```powershell
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete the persisted Neo4j volume and reseed from an empty database.
