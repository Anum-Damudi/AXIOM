import time
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.exceptions import AxiomException

logger = logging.getLogger("axiom.middleware")

def setup_exception_handlers(app):
    @app.exception_handler(AxiomException)
    async def axiom_exception_handler(request: Request, exc: AxiomException):
        detail = exc.detail
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": detail.get("code", "ERROR"),
                    "message": detail.get("message", "An error occurred.")
                }
            },
            headers=exc.headers
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        code = "HTTP_ERROR"
        if exc.status_code == 404:
            code = "NOT_FOUND"
        elif exc.status_code == 401:
            code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            code = "FORBIDDEN"
        elif exc.status_code == 400:
            code = "BAD_REQUEST"

        message = str(exc.detail)
        if isinstance(exc.detail, dict):
            code = exc.detail.get("code", code)
            message = exc.detail.get("message", str(exc.detail))

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": code,
                    "message": message
                }
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        err_msg = "Validation error"
        if errors:
            first_err = errors[0]
            loc = " -> ".join([str(x) for x in first_err.get("loc", [])])
            err_msg = f"{loc}: {first_err.get('msg', 'Invalid input')}"

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": err_msg
                }
            }
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled server exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred."
                }
            }
        )
