import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AXIOM — NEXUS-CRIME"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "axiom_nexus_crime_hackathon_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days for hackathon convenience
    
    # Database
    DATABASE_URL: str = "sqlite:///./axiom.db"
    
    # Neo4j Graph Database
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]
    
    # Ledger / Blockchain
    ANCHOR_MODE: str = "noop"  # "noop" or "evm"
    EVM_RPC_URL: str = "http://localhost:8545"
    EVM_CONTRACT_ADDRESS: str = ""
    EVM_PRIVATE_KEY: str = ""
    ENABLE_DEMO_TAMPER: bool = False
    LEDGER_SEAL_THRESHOLD: int = 10  # Number of unsealed entries before auto-seal
    LEDGER_SEAL_INTERVAL_SECONDS: int = 300  # Auto-seal interval in seconds
    
    # Phone Intelligence / CDR
    CDR_DEFAULT_REGION: str = "IN"  # Default country code for phone normalization
    CDR_MAX_ROWS: int = 10000  # Max rows per CDR import
    PERCEPTUAL_HASH_THRESHOLD: int = 8  # Hamming distance threshold for duplicate detection
    
    # Login security / rate limiting
    LOGIN_RATE_LIMIT_MINUTES: int = 15
    LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    CDR_MAX_FILE_SIZE_MB: int = 20

    # Development / demo seed accounts (DEVELOPMENT ONLY).
    # Override every value via environment variables in production.
    # Passwords are NEVER stored in plaintext - they are bcrypt-hashed at seed time.
    SEED_AUTO_CREATE: bool = True
    SEED_ADMIN_USERNAME: str = "admin"
    SEED_ADMIN_EMAIL: str = "admin@axiom.local"
    SEED_ADMIN_PASSWORD: str = "Axiom@Admin2026!"
    SEED_ADMIN_NAME: str = "AXIOM System Administrator"
    SEED_INVESTIGATOR_USERNAME: str = "investigator"
    SEED_INVESTIGATOR_EMAIL: str = "investigator@axiom.local"
    SEED_INVESTIGATOR_PASSWORD: str = "Axiom@Investigator2026!"
    SEED_INVESTIGATOR_NAME: str = "Principal Investigator"
    SEED_OFFICER_USERNAME: str = "officer"
    SEED_OFFICER_EMAIL: str = "officer@axiom.local"
    SEED_OFFICER_PASSWORD: str = "Axiom@Officer2026!"
    SEED_OFFICER_NAME: str = "Field Officer"

    # CV module integration. Absolute path to the cv-module directory; discovered
    # relative to the backend when left blank. The service runs honestly and marks
    # results MODEL_UNAVAILABLE when the module/dependencies are not installed.
    CV_MODULE_PATH: str = ""
    CV_ANALYSIS_TIMEOUT_SECONDS: int = 300

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
