from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], roles: Optional[list] = None, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "roles": roles or ["INVESTIGATOR"]
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.exceptions import UnauthorizedException, ForbiddenException

security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
):
    """Resolve the authenticated user from a valid JWT, verifying account status."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedException(message="Missing authentication token", code="MISSING_TOKEN")
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise UnauthorizedException(message="Invalid or expired token", code="INVALID_TOKEN")
    from app.models.user import User
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise UnauthorizedException(message="User not found", code="USER_NOT_FOUND")
    if not user.is_active:
        raise UnauthorizedException(message="Account is inactive", code="ACCOUNT_INACTIVE")
    return user

def require_roles(*allowed_roles: str):
    """Dependency factory enforcing role-based access control server-side."""
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise ForbiddenException(
                message=f"Role '{current_user.role}' is not permitted to perform this action",
                code="INSUFFICIENT_PERMISSIONS"
            )
        return current_user
    return role_checker

def get_client_ip(request: Request) -> str:
    """Best-effort client IP extraction (honours X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or ""
    return ""

