import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cors import cors_settings
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
app.include_router(care_logs.router)
app.include_router(providers.router)
app.include_router(appointments.router)
app.include_router(screening.router)
app.include_router(help_board.router)


@app.get("/health")
def health():
    return {"status": "ok"}
