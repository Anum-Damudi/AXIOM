from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException
from app.schemas import UserRegister, UserLogin, TokenResponse, UserResponse, ApiResponse
from app.services import AuthService

router = APIRouter()
security_bearer = HTTPBearer(auto_error=False)

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> str:
    if not credentials or not credentials.credentials:
        raise UnauthorizedException(message="Missing authentication token", code="MISSING_TOKEN")
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise UnauthorizedException(message="Invalid or expired token", code="INVALID_TOKEN")
    return payload["sub"]

@router.post("/register", response_model=ApiResponse[TokenResponse], status_code=status.HTTP_201_CREATED, tags=["Authentication"])
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """Register a new investigator or officer account."""
    token_resp = AuthService.register_user(db, user_in)
    return ApiResponse(success=True, data=token_resp)

@router.post("/login", response_model=ApiResponse[TokenResponse], tags=["Authentication"])
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    """Log in with username and password to receive a JWT access token."""
    token_resp = AuthService.login_user(db, login_in)
    return ApiResponse(success=True, data=token_resp)

@router.get("/me", response_model=ApiResponse[UserResponse], tags=["Authentication"])
def get_me(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Fetch current logged-in user profile."""
    user = AuthService.get_current_user(db, user_id)
    return ApiResponse(success=True, data=user)
