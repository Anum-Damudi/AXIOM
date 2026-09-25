from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas import ApiResponse
from app.schemas.auth import UserRegister, UserUpdate, UserResponse
from app.services import AuthService
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/users", tags=["User Management"])


def _require_db():
    return Depends(get_db)


@router.get("", response_model=ApiResponse, tags=["User Management"])
def list_users(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: list all application users with optional keyword filter."""
    users, total = AuthService.list_users(db, keyword=keyword, page=page, limit=limit)
    return ApiResponse(
        success=True,
        data={"users": users, "total": total, "page": page, "limit": limit}
    )


@router.get("/{user_id}", response_model=ApiResponse, tags=["User Management"])
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: fetch a single user by id."""
    return ApiResponse(success=True, data=AuthService.get_user(db, user_id))


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED, tags=["User Management"])
def create_user(
    user_in: UserRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: create a user with an explicit role."""
    user = AuthService.create_user(db, user_in, actor_user_id=current_user.id)
    return ApiResponse(success=True, data=user, message="User created")


@router.patch("/{user_id}", response_model=ApiResponse, tags=["User Management"])
def update_user(
    user_id: str,
    patch: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: update user profile, role, activity status or password."""
    user = AuthService.update_user(db, user_id, patch, actor_user_id=current_user.id)
    return ApiResponse(success=True, data=user, message="User updated")


@router.delete("/{user_id}", response_model=ApiResponse, tags=["User Management"])
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN"))
):
    """Admin: delete a user (guards against self-delete and last-admin)."""
    AuthService.delete_user(db, user_id, actor_user_id=current_user.id)
    return ApiResponse(success=True, message="User deleted")