import asyncio
import os

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .cors import cors_settings
from .database import engine
from .routers import (
    appointments,
    auth,
    care_logs,
    children,
    family,
    growth,
    help_board,
    providers,
    screening,
)

app = FastAPI(title="NestPath API")

# Which browser origins may call this API: CORS_ORIGINS in production, any
# localhost port in dev -- see app/cors.py. (Read after the router imports
# above, since importing app.database is what loads backend/.env.)
app.add_middleware(
    CORSMiddleware,
    allow_methods=["*"],
    allow_headers=["*"],
    **cors_settings(os.environ.get("CORS_ORIGINS")),
)


app.include_router(auth.router)
app.include_router(family.router)
app.include_router(children.router)
app.include_router(growth.router)
app.include_router(growth.reference_router)
app.include_router(care_logs.router)
app.include_router(providers.router)
app.include_router(appointments.router)
app.include_router(screening.router)
app.include_router(help_board.router)


# Render's health check: answers as soon as the server is up, without
# touching the database.
@app.get("/health")
def health():
    return {"status": "ok"}


# How long /health/ready waits for the database before answering "waking".
READY_TIMEOUT_SECONDS = 5.0
_database_check: asyncio.Future | None = None


def ping_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


# The frontend calls this as soon as a page opens, so the free-tier
# database (which suspends when idle, separately from this server) starts
# waking while the person types. If the database takes longer than the
# timeout, the check carries on in the background and finishes the wake;
# requests that arrive meanwhile wait on that same check rather than
# starting more. Failures only ever say "waking" -- no error details.
@app.get("/health/ready")
async def health_ready():
    global _database_check
    if _database_check is None or _database_check.done():
        _database_check = asyncio.ensure_future(run_in_threadpool(ping_database))
        # Mark a failure that finishes after everyone stopped waiting as seen.
        _database_check.add_done_callback(lambda f: f.cancelled() or f.exception())
    try:
        await asyncio.wait_for(asyncio.shield(_database_check), READY_TIMEOUT_SECONDS)
    except Exception:
        return JSONResponse({"status": "waking"}, status_code=503)
    return {"status": "ok"}
