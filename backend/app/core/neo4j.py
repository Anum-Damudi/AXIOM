import logging
from typing import Optional, Dict, Any, List
from neo4j import GraphDatabase, Driver
from app.core.config import settings

logger = logging.getLogger("axiom.neo4j")

class Neo4jService:
    def __init__(self):
        self.driver: Optional[Driver] = None
        self._is_connected: bool = False

    def connect(self):
        if not self.driver:
            try:
                self.driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
                )
                # Verify connectivity
                self.driver.verify_connectivity()
                self._is_connected = True
                logger.info("Successfully connected to Neo4j database.")
            except Exception as e:
                logger.warning(f"Neo4j connection failed: {e}. Graph queries will fallback gracefully.")
                self._is_connected = False
                self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()
            self._is_connected = False

    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not self.driver:
            self.connect()
        if not self.driver or not self._is_connected:
            logger.warning("Neo4j driver unavailable for query execution.")
            return []
        
        try:
            with self.driver.session() as session:
                result = session.run(query, parameters or {})
                return [record.data() for record in result]
        except Exception as e:
            logger.error(f"Error executing Cypher query: {e}")
            return []

neo4j_client = Neo4jService()
