from typing import Generic, TypeVar, Optional, Any, List
from pydantic import BaseModel

T = TypeVar("T")

class ErrorDetail(BaseModel):
    code: str
    message: str

class MetaPagination(BaseModel):
    page: int = 1
    limit: int = 20
    total: int = 0

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    meta: Optional[Any] = None

class ApiErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
