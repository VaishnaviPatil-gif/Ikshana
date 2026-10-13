import asyncio
import websockets
import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("sarvas")

class AISStreamClient:
    def __init__(self):
        self.api_key = os.getenv("AISSTREAM_API_KEY", "")
        self.ws_url = "wss://stream.aisstream.io/v0/stream"
        # Indian Ocean approx bounding box
        self.bounding_box = [[-30.0, 40.0], [30.0, 100.0]]
        self.running = False
        self.task = None
        self.connected = False

    async def _connect_and_listen(self):
        if not self.api_key:
            logger.info("[AIS] No AISStream API key configured. Client is no-op.")
            self.running = False
            return
            
        subscribe_message = {
            "APIKey": self.api_key,
            "BoundingBoxes": [self.bounding_box],
            "FilterMessageTypes": ["PositionReport"]
        }
        
        try:
            async with websockets.connect(self.ws_url) as ws:
                await ws.send(json.dumps(subscribe_message))
                self.connected = True
                logger.info("[AIS] Connected to AISStream and subscribed to Indian Ocean.")
                
                while self.running:
                    try:
                        message = await asyncio.wait_for(ws.recv(), timeout=10.0)
                        data = json.loads(message)
                        if data.get("MessageType") == "PositionReport":
                            msg = data.get("Message", {}).get("PositionReport", {})
                            mmsi = data.get("MetaData", {}).get("MMSI")
                            lat = msg.get("Latitude")
                            lon = msg.get("Longitude")
                            # We could store it in DB, but for now we'll just log it lightly 
                            # to avoid spamming the log in this demo client
                            if lat and lon:
                                pass # In a real implementation we would insert into the vessel_positions table
                    except asyncio.TimeoutError:
                        continue
                    except websockets.exceptions.ConnectionClosed:
                        logger.warning("[AIS] Connection closed unexpectedly.")
                        break
        except Exception as e:
            logger.error(f"[AIS] Error connecting to AISStream: {e}")
        finally:
            self.connected = False

    def start(self):
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._connect_and_listen())

    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            self.task = None

ais_client = AISStreamClient()
