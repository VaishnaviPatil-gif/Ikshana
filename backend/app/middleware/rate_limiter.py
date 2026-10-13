import time
from typing import Dict, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class RateLimiter:
    def __init__(self):
        # ip -> (count, reset_time)
        self.requests: Dict[str, Tuple[int, float]] = {}
        
    def check_rate_limit(self, ip: str, limit: int, window: int) -> bool:
        current_time = time.time()
        if ip in self.requests:
            count, reset_time = self.requests[ip]
            if current_time > reset_time:
                self.requests[ip] = (1, current_time + window)
                return True
            if count >= limit:
                return False
            self.requests[ip] = (count + 1, reset_time)
            return True
        else:
            self.requests[ip] = (1, current_time + window)
            return True

rate_limiter = RateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Never rate-limit CORS preflight or health checks
        if request.method == "OPTIONS" or request.url.path in ("/", "/health"):
            return await call_next(request)

        ip = request.client.host if request.client else "127.0.0.1"
        path = request.url.path
        
        limit = 120
        window = 60
        
        if path.startswith("/api/spills/upload-sar"):
            limit = 60
        elif path.startswith("/api/reports/"):
            limit = 60
            
        if not rate_limiter.check_rate_limit(ip, limit, window):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too Many Requests"}
            )
            
        response = await call_next(request)
        return response
