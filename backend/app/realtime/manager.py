from fastapi import WebSocket
from typing import Dict, List, Optional
import json

class ConnectionManager:
    def __init__(self):
        # role -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {
            "public": [],
            "coast_guard": [],
            "regional_manager": [],
            "higher_authority": []
        }

    async def connect(self, websocket: WebSocket, role: str):
        await websocket.accept()
        if role in self.active_connections:
            self.active_connections[role].append(websocket)
        else:
            self.active_connections["public"].append(websocket)

    def disconnect(self, websocket: WebSocket, role: str):
        if role in self.active_connections:
            if websocket in self.active_connections[role]:
                self.active_connections[role].remove(websocket)
        else:
            if websocket in self.active_connections["public"]:
                self.active_connections["public"].remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for role_conns in self.active_connections.values():
            for connection in role_conns:
                try:
                    await connection.send_text(message)
                except:
                    pass

    async def send_to_role(self, role: str, message: dict):
        if role in self.active_connections:
            text_msg = json.dumps(message)
            for connection in self.active_connections[role]:
                try:
                    await connection.send_text(text_msg)
                except:
                    pass

manager = ConnectionManager()
