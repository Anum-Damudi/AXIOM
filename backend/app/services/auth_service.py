import uuid
from sqlalchemy.orm import Session
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import UnauthorizedException, ConflictException, NotFoundException
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from app.services.audit_service import AuditService

class AuthService:
    @staticmethod
    def register_user(db: Session, user_in: UserRegister) -> TokenResponse:
        existing_user = db.query(User).filter(
            (User.username == user_in.username) | (User.email == user_in.email)
        ).first()
        if existing_user:
            raise ConflictException(message="Username or Email already registered", code="USER_ALREADY_EXISTS")

        user_id = f"U{uuid.uuid4().hex[:6].upper()}"
        user = User(
            id=user_id,
            username=user_in.username,
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role or "INVESTIGATOR"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        AuditService.log_action(db, action="USER_REGISTER", user_id=user.id, resource_type="user", resource_id=user.id)

        token = create_access_token(subject=user.id, roles=[user.role])
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )

    @staticmethod
    def login_user(db: Session, login_in: UserLogin) -> TokenResponse:
        user = db.query(User).filter(User.username == login_in.username).first()
        if not user or not verify_password(login_in.password, user.hashed_password):
            raise UnauthorizedException(message="Invalid username or password", code="INVALID_CREDENTIALS")
        
        if not user.is_active:
            raise UnauthorizedException(message="Account is inactive", code="ACCOUNT_INACTIVE")

        AuditService.log_action(db, action="USER_LOGIN", user_id=user.id, resource_type="user", resource_id=user.id)

        token = create_access_token(subject=user.id, roles=[user.role])
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )

    @staticmethod
    def get_current_user(db: Session, user_id: str) -> UserResponse:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(message="User not found", code="USER_NOT_FOUND")
        return UserResponse.model_validate(user)
