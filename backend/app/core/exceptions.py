from fastapi import HTTPException, status

class AxiomException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, headers: dict = None):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
            headers=headers
        )

class NotFoundException(AxiomException):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, code=code, message=message)

class BadRequestException(AxiomException):
    def __init__(self, message: str = "Bad request", code: str = "BAD_REQUEST"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, code=code, message=message)

class UnauthorizedException(AxiomException):
    def __init__(self, message: str = "Authentication required", code: str = "UNAUTHORIZED"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=code,
            message=message,
            headers={"WWW-Authenticate": "Bearer"}
        )

class ForbiddenException(AxiomException):
    def __init__(self, message: str = "Access forbidden", code: str = "FORBIDDEN"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, code=code, message=message)

class ConflictException(AxiomException):
    def __init__(self, message: str = "Resource conflict", code: str = "CONFLICT"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, code=code, message=message)

class UnprocessableEntityException(AxiomException):
    def __init__(self, message: str = "Validation failed", code: str = "UNPROCESSABLE_ENTITY"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, code=code, message=message)

class InternalServerErrorException(AxiomException):
    def __init__(self, message: str = "Internal server error", code: str = "INTERNAL_SERVER_ERROR"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, code=code, message=message)
