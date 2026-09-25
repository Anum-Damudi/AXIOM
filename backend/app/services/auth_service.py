import uuid
import time
import logging
from threading import Lock
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import (
    UnauthorizedException, ConflictException, NotFoundException, BadRequestException
)
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserUpdate, TokenResponse, UserResponse
from app.services.audit_service import AuditService

logger = logging.getLogger("axiom.auth")

# Simple in-memory login rate limiter: key = f"{ip}:{identifier.lower()}" -> list of timestamps
_login_attempts: dict = {}
_login_lock = Lock()


class AuthService:
    @staticmethod
    def _record_attempt(identifier: str, ip: str):
        key = f"{ip or 'local'}:{identifier.lower().strip()}"
        now = time.time()
        window = settings.LOGIN_RATE_LIMIT_MINUTES * 60
        with _login_lock:
            stamps = _login_attempts.get(key, [])
            stamps = [t for t in stamps if now - t < window]
            _login_attempts[key] = stamps

    @staticmethod
    def check_rate_limit(identifier: str, ip: str):
        key = f"{ip or 'local'}:{identifier.lower().strip()}"
        now = time.time()
        window = settings.LOGIN_RATE_LIMIT_MINUTES * 60
        with _login_lock:
            stamps = _login_attempts.get(key, [])
            stamps = [t for t in stamps if now - t < window]
            _login_attempts[key] = stamps
        if len(stamps) >= settings.LOGIN_RATE_LIMIT_ATTEMPTS:
            raise UnauthorizedException(
                message=f"Too many failed login attempts. Try again in {settings.LOGIN_RATE_LIMIT_MINUTES} minutes.",
                code="RATE_LIMITED"
            )

    @staticmethod
    def register_user(db: Session, user_in: UserRegister) -> TokenResponse:
        username = user_in.username.strip()
        existing_user = db.query(User).filter(
            or_(User.username == username, User.email == user_in.email)
        ).first()
        if existing_user:
            raise ConflictException(message="Username or Email already registered", code="USER_ALREADY_EXISTS")

        user_id = f"U{uuid.uuid4().hex[:6].upper()}"
        user = User(
            id=user_id,
            username=username,
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            role=(user_in.role or "INVESTIGATOR").upper()
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
    def login_user(
        db: Session,
        login_in: UserLogin,
        ip_address: Optional[str] = None,
        success_cb: Optional[callable] = None
    ) -> TokenResponse:
        """Log in by username OR email, with rate limiting and audit logging."""
        identifier = login_in.username.strip()
        if not identifier or not login_in.password:
            raise UnauthorizedException(message="Invalid username or password", code="INVALID_CREDENTIALS")

        AuthService.check_rate_limit(identifier, ip_address)

        user = db.query(User).filter(
            or_(User.username == identifier, User.email == identifier.lower())
        ).first()

        if not user or not verify_password(login_in.password, user.hashed_password):
            AuthService._record_attempt(identifier, ip_address)
            AuditService.log_action(
                db,
                action="LOGIN_FAILED",
                user_id=str(user.id) if user else None,
                resource_type="auth",
                resource_id=identifier,
                details={"identifier": identifier[:3] + "***", "ip": ip_address},
                ip_address=ip_address
            )
            raise UnauthorizedException(message="Invalid username or password", code="INVALID_CREDENTIALS")

        if not user.is_active:
            AuditService.log_action(
                db, action="LOGIN_BLOCKED_ACCOUNT", user_id=user.id,
                resource_type="auth", resource_id=user.id,
                details={"ip": ip_address}, ip_address=ip_address
            )
            raise UnauthorizedException(message="Account is inactive", code="ACCOUNT_INACTIVE")

        AuditService.log_action(
            db, action="USER_LOGIN", user_id=user.id,
            resource_type="user", resource_id=user.id,
            details={"ip": ip_address}, ip_address=ip_address
        )
        if success_cb:
            success_cb(user.id)

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
        if not user.is_active:
            raise UnauthorizedException(message="Account is inactive", code="ACCOUNT_INACTIVE")
        return UserResponse.model_validate(user)

    # ---- Admin user management (server-side RBAC) ----

    @staticmethod
    def list_users(db: Session, keyword: Optional[str] = None, page: int = 1, limit: int = 50):
        query = db.query(User)
        if keyword:
            pattern = f"%{keyword}%"
            query = query.filter(
                or_(User.username.ilike(pattern), User.email.ilike(pattern), User.role.ilike(pattern))
            )
        total = query.count()
        users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return [UserResponse.model_validate(u) for u in users], total

    @staticmethod
    def get_user(db: Session, user_id: str) -> UserResponse:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(message="User not found", code="USER_NOT_FOUND")
        return UserResponse.model_validate(user)

    @staticmethod
    def create_user(db: Session, user_in: UserRegister, actor_user_id: Optional[str] = None) -> UserResponse:
        username = user_in.username.strip()
        existing = db.query(User).filter(
            or_(User.username == username, User.email == user_in.email)
        ).first()
        if existing:
            raise ConflictException(message="Username or Email already registered", code="USER_ALREADY_EXISTS")

        user = User(
            id=f"U{uuid.uuid4().hex[:6].upper()}",
            username=username,
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            role=(user_in.role or "INVESTIGATOR").upper(),
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        AuditService.log_action(
            db, action="USER_CREATED", user_id=actor_user_id,
            resource_type="user", resource_id=user.id,
            details={"created_user": user.id, "role": user.role}
        )
        return UserResponse.model_validate(user)

    @staticmethod
    def update_user(db: Session, user_id: str, patch: UserUpdate, actor_user_id: Optional[str] = None) -> UserResponse:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(message="User not found", code="USER_NOT_FOUND")

        data = patch.model_dump(exclude_unset=True)
        password = data.pop("password", None)

        if "username" in data and data["username"]:
            username = data["username"].strip()
            dup = db.query(User).filter(User.username == username, User.id != user_id).first()
            if dup:
                raise ConflictException(message="Username already in use", code="USERNAME_TAKEN")
            user.username = username
        if "email" in data and data["email"]:
            email = str(data["email"]).lower()
            dup = db.query(User).filter(User.email == email, User.id != user_id).first()
            if dup:
                raise ConflictException(message="Email already in use", code="EMAIL_TAKEN")
            user.email = email
        if "role" in data and data["role"]:
            user.role = data["role"].upper()
        if "is_active" in data:
            user.is_active = bool(data["is_active"])
            if not user.is_active:
                AuditService.log_action(
                    db, action="USER_DEACTIVATED", user_id=actor_user_id,
                    resource_type="user", resource_id=user.id
                )
        if password:
            user.hashed_password = get_password_hash(password)

        db.commit()
        db.refresh(user)
        AuditService.log_action(
            db, action="USER_UPDATED", user_id=actor_user_id,
            resource_type="user", resource_id=user.id,
            details={k: v for k, v in data.items() if k != "password"}
        )
        return UserResponse.model_validate(user)

    @staticmethod
    def delete_user(db: Session, user_id: str, actor_user_id: Optional[str] = None) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(message="User not found", code="USER_NOT_FOUND")
        if user.id == actor_user_id:
            raise BadRequestException(message="You cannot delete your own account", code="SELF_DELETE_FORBIDDEN")
        if user.role == "ADMIN" and user.id != actor_user_id:
            admin_count = db.query(User).filter(User.role == "ADMIN").count()
            if admin_count <= 1:
                raise BadRequestException(message="Cannot delete the last administrator", code="LAST_ADMIN")

        db.delete(user)
        db.commit()
        AuditService.log_action(
            db, action="USER_DELETED", user_id=actor_user_id,
            resource_type="user", resource_id=user_id
        )