from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from app.realtime.manager import manager
from typing import Optional

router = APIRouter(tags=["realtime"])

@router.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket, role: str = Query("public")):
    await manager.connect(websocket, role)
    try:
        while True:
            # ping/pong could be handled here
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, role)
