import time
import json
import logging
import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Ensure logs directory exists
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

logger = logging.getLogger("sarvas")
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(os.path.join(log_dir, "sarvas.log"))
console_handler = logging.StreamHandler()
formatter = logging.Formatter('%(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # User ID might not be easily available if token is not parsed, but we log what we have
        response = await call_next(request)
        
        process_time = time.time() - start_time
        log_dict = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(process_time * 1000, 2),
            "ip": request.client.host if request.client else "unknown"
        }
        
        logger.info(json.dumps(log_dict))
        return response
