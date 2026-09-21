from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import appointments, auth, care_logs, children, growth, help_board, providers, screening

app = FastAPI(title="NestPath API")

# Allows the Next.js dev server to call this API from the browser. A
# port regex (rather than a fixed localhost:3000) because this dev
# machine has a stray process squatting on 3000, so Next's autoPort
# routinely picks a different one. Revisit as real origins are added.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://localhost:\d+$",
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
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
