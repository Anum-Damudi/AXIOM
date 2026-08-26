"""Smoke-test the seeded Neo4j graph through the FastAPI service.

Usage: python scripts/graph_smoke_test.py [--base-url http://localhost:8000]
"""

from __future__ import annotations

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


EXPECTED_CASES = {"C287", "C204"}


def get_json(base_url: str, path: str) -> dict:
    request = Request(f"{base_url.rstrip('/')}{path}", headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=60) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status} for {path}")
            return json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} for {path}: {exc.reason}") from exc
    except (TimeoutError, URLError) as exc:
        raise RuntimeError(f"Cannot reach {base_url}: {exc.reason}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def run(base_url: str) -> None:
    health = get_json(base_url, "/graph/health")
    require(health.get("neo4j") is True, f"Neo4j is not healthy: {health}")
    print("PASS /graph/health: Neo4j connected")

    case = get_json(base_url, "/graph/case/C101")
    require(case.get("case", {}).get("id") == "C101", "C101 was not returned")
    require(case.get("nodes"), "C101 graph has no nodes")
    require(case.get("edges"), "C101 graph has no edges")
    require(case.get("timeline"), "C101 timeline has no events")
    print(
        "PASS /graph/case/C101: "
        f"{len(case['nodes'])} nodes, {len(case['edges'])} edges, "
        f"{len(case['timeline'])} timeline items"
    )

    links = get_json(base_url, "/graph/hidden-links?case_id=C101&min_score=20")
    link_ids = {link.get("case_b") for link in links.get("links", [])}
    missing = EXPECTED_CASES - link_ids
    require(not missing, f"Hidden links missing expected cases: {sorted(missing)}")
    require(
        links.get("interpretation") == "inferred_potential_connection",
        "Hidden-link interpretation is not investigative-lead language",
    )
    print(
        "PASS /graph/hidden-links?case_id=C101: "
        f"found expected cases {sorted(EXPECTED_CASES)}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke-test the AXIOM graph API")
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()

    try:
        run(args.base_url)
    except RuntimeError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("Graph smoke test passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
