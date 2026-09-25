from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token, get_current_user, verify_password, get_password_hash
from app.core.exceptions import UnauthorizedException
from app.schemas import UserRegister, UserLogin, TokenResponse, UserResponse, ApiResponse
from app.schemas.auth import PublicUserRegister, UserUpdate
from app.services import AuthService
from app.models.user import User

router = APIRouter()
security_bearer = HTTPBearer(auto_error=False)

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> str:
    """Resolve the user id from the bearer token (kept for internal per-request routing)."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedException(message="Missing authentication token", code="MISSING_TOKEN")
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise UnauthorizedException(message="Invalid or expired token", code="INVALID_TOKEN")
    return payload["sub"]

@router.post("/register", response_model=ApiResponse[TokenResponse], status_code=status.HTTP_201_CREATED, tags=["Authentication"])
def register(user_in: PublicUserRegister, db: Session = Depends(get_db)):
    """Register a new investigator or officer account (never an admin)."""
    token_resp = AuthService.register_user(db, user_in)
    return ApiResponse(success=True, data=token_resp)

@router.post("/login", response_model=ApiResponse[TokenResponse], tags=["Authentication"])
def login(login_in: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Log in with username OR email and password to receive a JWT access token."""
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "local")
    token_resp = AuthService.login_user(db, login_in, ip_address=ip_address)
    return ApiResponse(success=True, data=token_resp)

@router.get("/me", response_model=ApiResponse[UserResponse], tags=["Authentication"])
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch current logged-in user profile."""
    return ApiResponse(success=True, data=UserResponse.model_validate(current_user))

from app.schemas.auth import PasswordChangeRequest

@router.post("/change-password", response_model=ApiResponse, tags=["Authentication"])
def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change the current user's password (old password must be verified)."""
    if not verify_password(body.old_password, current_user.hashed_password):
        raise UnauthorizedException(message="Current password is incorrect", code="OLD_PASSWORD_WRONG")
    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    from app.services.audit_service import AuditService
    AuditService.log_action(db, action="PASSWORD_CHANGED", user_id=current_user.id, resource_type="user", resource_id=current_user.id)
    return ApiResponse(success=True, message="Password updated")