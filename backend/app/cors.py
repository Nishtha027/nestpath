"""CORS configuration, driven by the CORS_ORIGINS environment variable.

Production: set CORS_ORIGINS to the frontend's exact origin(s),
comma-separated (e.g. https://nestpath.vercel.app) and only those are
allowed. Unset (local dev): any http://localhost:<port> is allowed -- this
dev machine's Next.js autoPort routinely picks a port other than 3000.

Unset fails closed on a deployed host: the localhost fallback matches
nothing real, so a forgotten variable blocks the frontend rather than
opening the API to arbitrary sites.
"""

_DEV_ORIGIN_REGEX = r"^http://localhost:\d+$"


def cors_settings(raw_origins: str | None) -> dict:
    """Keyword arguments for CORSMiddleware."""
    # rstrip("/"): browsers send Origin without a trailing slash, but
    # that's an easy thing to paste in with one.
    origins = [o.strip().rstrip("/") for o in (raw_origins or "").split(",") if o.strip()]
    if origins:
        return {"allow_origins": origins}
    return {"allow_origin_regex": _DEV_ORIGIN_REGEX}
