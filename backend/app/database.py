"""SQLAlchemy engine/session setup. Connection string comes from the
DATABASE_URL environment variable (see .env.example) -- nothing else in
this module should hold a hardcoded connection string.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


def normalize_database_url(url: str) -> str:
    """Hosted Postgres providers (Neon, Render, Supabase, Heroku-style)
    hand out postgres:// or postgresql:// URLs. SQLAlchemy would map those
    to the psycopg2 driver, which isn't installed -- this app uses
    psycopg 3, so point them at it explicitly.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = normalize_database_url(os.environ["DATABASE_URL"])

# pool_pre_ping: serverless Postgres (e.g. Neon's free tier) suspends when
# idle and drops its connections, so a pooled connection can be dead by the
# next request. Pinging first replaces a dead one instead of surfacing a
# 500 to whoever hits the app after a quiet spell. pool_recycle also retires
# any connection older than 5 minutes (Neon suspends after ~5 idle minutes),
# so stale ones are replaced before they're even pinged.
POOL_RECYCLE_SECONDS = 300
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=POOL_RECYCLE_SECONDS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
