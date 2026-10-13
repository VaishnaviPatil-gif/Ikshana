import asyncio
from typing import Dict, AsyncGenerator
import json

class SSEManager:
    def __init__(self):
        self.connections: Dict[str, asyncio.Queue] = {}

    def create_session(self, upload_id: str):
        if upload_id not in self.connections:
            self.connections[upload_id] = asyncio.Queue()

    async def update_progress(self, upload_id: str, stage: str, percent: int, message: str):
        if upload_id in self.connections:
            event = {
                "stage": stage,
                "percent": percent,
                "message": message
            }
            await self.connections[upload_id].put(event)
            if stage in ['complete', 'error']:
                # The final message, give it a moment to send then cleanup
                asyncio.create_task(self._cleanup(upload_id))

    async def _cleanup(self, upload_id: str):
        await asyncio.sleep(5)
        if upload_id in self.connections:
            del self.connections[upload_id]

    async def get_stream(self, upload_id: str) -> AsyncGenerator[Dict, None]:
        if upload_id not in self.connections:
            yield {
                "event": "error",
                "data": json.dumps({"error": "Invalid or expired upload_id"})
            }
            return
            
        try:
            while True:
                event = await self.connections[upload_id].get()
                yield {
                    "event": "progress",
                    "data": json.dumps(event)
                }
                if event["stage"] in ["complete", "error"]:
                    break
        except asyncio.CancelledError:
            pass

sse_manager = SSEManager()
