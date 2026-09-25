from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator

VALID_ROLES = {"ADMIN", "INVESTIGATOR", "OFFICER"}
PUBLIC_REGISTER_ROLES = {"INVESTIGATOR", "OFFICER"}

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = "INVESTIGATOR"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is None:
            return "INVESTIGATOR"
        v = v.upper()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

class PublicUserRegister(UserRegister):
    """Self-service registration; ADMIN is never reachable via the public endpoint."""

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is None:
            return "INVESTIGATOR"
        v = v.upper()
        if v not in PUBLIC_REGISTER_ROLES:
            raise ValueError(f"role must be one of {sorted(PUBLIC_REGISTER_ROLES)}")
        return v

class UserLogin(BaseModel):
    username: str = Field(..., description="Username OR email address")
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is None:
            return None
        v = v.upper()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PasswordChangeRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

class LoginAttemptData(BaseModel):
    identifier: str
    ip: str
