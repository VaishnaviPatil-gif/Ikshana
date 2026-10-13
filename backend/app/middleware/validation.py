from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

MAX_UPLOAD_SIZE = 100 * 1024 * 1024 # 100 MB
ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/tiff",
    "application/pdf",
    "application/zip",
    "application/x-hdf5",
    "application/x-netcdf"
]

class ValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and "upload" in request.url.path:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_UPLOAD_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "File size exceeds 100MB limit"}
                )
        return await call_next(request)

def sanitize_input(text: str) -> str:
    # simple sanitization helper
    if not text:
        return text
    return text.replace("<", "&lt;").replace(">", "&gt;")
