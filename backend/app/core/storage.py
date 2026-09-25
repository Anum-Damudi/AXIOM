import os
import logging
from abc import ABC, abstractmethod
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("axiom.storage")

class StorageBackend(ABC):
    """Abstract interface for file storage backends."""
    
    @abstractmethod
    def save(self, filename: str, data: bytes) -> str:
        """
        Save file data and return the path.
        """
        pass
    
    @abstractmethod
    def load(self, path: str) -> Optional[bytes]:
        """
        Load file data from path.
        """
        pass
    
    @abstractmethod
    def delete(self, path: str) -> bool:
        """
        Delete file at path. Returns True if successful.
        """
        pass
    
    @abstractmethod
    def exists(self, path: str) -> bool:
        """
        Check if file exists at path.
        """
        pass

class LocalStorage(StorageBackend):
    """Local disk storage implementation."""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir or settings.UPLOAD_DIR
        os.makedirs(self.base_dir, exist_ok=True)
    
    def save(self, filename: str, data: bytes) -> str:
        """Save file to local disk."""
        path = os.path.join(self.base_dir, filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        logger.debug(f"Saved file to local storage: {path}")
        return path
    
    def load(self, path: str) -> Optional[bytes]:
        """Load file from local disk."""
        if not self.exists(path):
            return None
        with open(path, "rb") as f:
            return f.read()
    
    def delete(self, path: str) -> bool:
        """Delete file from local disk."""
        try:
            if self.exists(path):
                os.remove(path)
                logger.debug(f"Deleted file from local storage: {path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {path}: {e}")
            return False
    
    def exists(self, path: str) -> bool:
        """Check if file exists on local disk."""
        return os.path.exists(path)

class S3Storage(StorageBackend):
    """S3-compatible storage implementation (stub for future use)."""
    
    def __init__(self, bucket: str = None, region: str = None):
        self.bucket = bucket
        self.region = region
        logger.warning("S3Storage is a stub - not implemented yet")
    
    def save(self, filename: str, data: bytes) -> str:
        """Save file to S3 (stub)."""
        raise NotImplementedError("S3Storage not yet implemented")
    
    def load(self, path: str) -> Optional[bytes]:
        """Load file from S3 (stub)."""
        raise NotImplementedError("S3Storage not yet implemented")
    
    def delete(self, path: str) -> bool:
        """Delete file from S3 (stub)."""
        raise NotImplementedError("S3Storage not yet implemented")
    
    def exists(self, path: str) -> bool:
        """Check if file exists in S3 (stub)."""
        raise NotImplementedError("S3Storage not yet implemented")

def create_storage() -> StorageBackend:
    """Factory function to create storage backend based on STORAGE_BACKEND env var."""
    backend_type = getattr(settings, 'STORAGE_BACKEND', 'local').lower()
    
    if backend_type == 's3':
        return S3Storage()
    else:
        return LocalStorage()
