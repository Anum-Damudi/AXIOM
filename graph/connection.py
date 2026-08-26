"""Neo4j driver lifecycle."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Iterator

from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase, Session

load_dotenv()


def _settings() -> dict[str, str]:
    return {
        "uri": os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        "user": os.getenv("NEO4J_USER", "neo4j"),
        "password": os.getenv("NEO4J_PASSWORD", "nexuscrime"),
        "database": os.getenv("NEO4J_DATABASE", "neo4j"),
    }


def create_driver() -> Driver:
    cfg = _settings()
    return GraphDatabase.driver(cfg["uri"], auth=(cfg["user"], cfg["password"]))


@lru_cache(maxsize=1)
def get_driver() -> Driver:
    return create_driver()


def get_database() -> str:
    return _settings()["database"]


def session() -> Session:
    return get_driver().session(database=get_database())


def to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if hasattr(value, "iso_format"):
        return value.iso_format()
    return str(value)


def run_query(cypher: str, **params: Any) -> list[dict[str, Any]]:
    with session() as sess:
        result = sess.run(cypher, **params)
        return [to_jsonable(record.data()) for record in result]


def run_write(cypher: str, **params: Any) -> list[dict[str, Any]]:
    def _work(tx) -> list[dict[str, Any]]:
        result = tx.run(cypher, **params)
        return [to_jsonable(record.data()) for record in result]

    with session() as sess:
        return sess.execute_write(_work)


def iter_query(cypher: str, **params: Any) -> Iterator[dict[str, Any]]:
    with session() as sess:
        result = sess.run(cypher, **params)
        for record in result:
            yield to_jsonable(record.data())


def verify_connectivity() -> bool:
    get_driver().verify_connectivity()
    return True


def close_driver() -> None:
    get_driver().close()
    get_driver.cache_clear()
