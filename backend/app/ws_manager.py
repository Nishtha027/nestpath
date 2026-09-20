"""In-memory WebSocket connection registry, tracking active connections
per family so a new CareLog entry can be broadcast in real time to
every caregiver currently connected for that family.

Single-process, in-memory only -- fine for one uvicorn worker; would
need a shared pub/sub (e.g. Redis) behind multiple workers/processes.
"""

from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = {}

    async def connect(self, family_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(family_id, set()).add(websocket)

    def disconnect(self, family_id: UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(family_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            del self._connections[family_id]

    async def broadcast(self, family_id: UUID, message: dict) -> None:
        for websocket in list(self._connections.get(family_id, ())):
            await websocket.send_json(message)


manager = ConnectionManager()
