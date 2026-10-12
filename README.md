# NestPath

A companion app for new parents: a personalized vaccine schedule, growth
tracking, a shared real-time care log, appointment booking, a postpartum
check-in, and a help board for the people around a new family.

**Live demo:** _not deployed yet -- the URL goes here once the first
deployment is verified (see [Deploying](#deploying))._

> Free-tier hosting sleeps when idle, so the first load after a quiet spell
> may take ~30 seconds while the backend wakes up. It's fast again after that.

## What it does

- **Families and caregivers** -- sign up and start a family, or join one with
  an invite code shown on the dashboard. Everyone in a family sees the same
  children, care log and help board; other families' data is never visible.
- **Vaccine schedule** -- generated from the CDC schedule for the child's
  birth date. Marking a dose given re-runs the catch-up logic from the real
  date it was given, so a late dose visibly pushes the next one back.
- **Growth** -- weight entries are scored against the WHO weight-for-age
  tables (percentile and z-score) and charted.
- **Baby tracker (live)** -- log feeds (breast with side and minutes, bottle
  or solids in ml or oz), sleep (a start/stop timer or a past nap) and
  diapers (wet, dirty or both) in a few taps. Home shows the last feed, sleep
  and diaper with a live "time since"; History groups entries by day, with
  filters and edit/delete; Insights charts feeds, amounts and sleep per day
  over 7 or 30 days (today is marked "so far" and left out of the
  averages); and a printable, copyable 7-day summary can be shared
  with the pediatrician (linked from each booked appointment). Every change
  reaches the other caregivers' open screens over a WebSocket, with who
  logged it. Numbers only: it never judges an amount.
- **Appointments** -- providers publish availability; booking is race-safe
  (two people can't take the same slot) and generates a visit checklist
  based on the baby's age.
- **Postpartum check-in** -- the 10-item EPDS questionnaire with the real
  scoring. Any self-harm answer is always treated as high risk and shows the
  988 Suicide & Crisis Lifeline. It is a screening tool, not a diagnosis.
  High-risk results appear in a provider-only Alerts feed.
- **Help board** -- post a need (a meal, an errand), and another caregiver
  claims it. Claiming is race-safe, and you can't claim your own request.

## Project layout

```
backend/              FastAPI + SQLAlchemy 2 + Alembic + Postgres
  app/                  routers/, services/, models, schemas, auth, CORS
  alembic/versions/     database migrations
  reference-data/       sourced CDC vaccine + WHO growth data (own README)
  scripts/              seed_demo_data.py, smoke_test_live.py
  tests/                pytest suite
frontend/             Next.js 16 / React 19 / Tailwind app
render.yaml           Render blueprint for the API
```

## Running locally

Prerequisites: Python 3.12+, Node.js 20+, and a Postgres database (a local
Docker container is fine).

```bash
docker run -d --name nestpath-db \
  -e POSTGRES_USER=nestpath -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=nestpath \
  -p 5432:5432 postgres:16-alpine
```

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env             # then set DATABASE_URL and JWT_SECRET
python -m alembic upgrade head
python scripts/seed_demo_data.py # demo providers, slots, logins and a week of tracker data
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`). The
seed script creates three demo providers with appointment slots and a
provider-flagged account (`demo-provider@example.com`; against a local
database its password is `LOCAL_DEFAULT_PASSWORD` in the script) that can open
the Alerts page. There is no admin UI -- providers, slots and the provider
flag are created by this script.

Against a local database only, it also creates a demo family for the baby
tracker: a parent login (`demo-parent@example.com`; its password is
`LOCAL_PARENT_PASSWORD` in the script), a second caregiver, a demo child and
the last week of made-up feeds, sleeps and diapers. Re-running it adds only
what's missing (the days since the last run). It skips this part for any
other database host.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_URL; the backend's URL
npm run dev
```

Open `http://localhost:3000`. Under 768px wide (a phone, or the browser's
device toolbar) the app uses a bottom tab bar (Home, Log, History,
Insights, More); wider screens get the top tabs. The login is kept in the tab's `sessionStorage`,
so it survives a refresh (and is gone when the tab closes). Tokens last 60
minutes; after that, or if the server ever rejects one, you're signed out and
asked to log in again.

**Tests**

```bash
cd backend && python -m pytest
```

> The tests drop and recreate every table in `DATABASE_URL`. Point it at a
> throwaway database, never one you care about -- and re-run the seed script
> afterwards if you were using that database for the app.

## Deploying

Three free-tier services: **Neon** (Postgres), **Render** (API), **Vercel**
(frontend). The order matters because each URL feeds the next step.

| Where | Variable | Value |
|---|---|---|
| Render | `DATABASE_URL` | the Neon connection string (the direct, non-pooled one) |
| Render | `JWT_SECRET` | generated automatically by `render.yaml` |
| Render | `CORS_ORIGINS` | the Vercel URL, e.g. `https://nestpath.vercel.app` -- exact, no path. Added in step 5 |
| Vercel | `NEXT_PUBLIC_API_URL` | the Render URL, e.g. `https://nestpath-api.onrender.com` -- must be `https://` |

1. **Database.** Create a Neon project (pick a region near Render's, e.g. AWS
   `us-west-2`) and copy its connection string.
2. **Migrate and seed**, from your machine, with the URL on the command line
   rather than saved in `.env`:
   ```bash
   cd backend
   DATABASE_URL='<neon url>' python -m alembic upgrade head
   DATABASE_URL='<neon url>' DEMO_PROVIDER_PASSWORD='<a real secret>' DEMO_SLOT_DAYS=30 \
     python scripts/seed_demo_data.py
   ```
   The seed script refuses to run against a non-local database without
   `DEMO_PROVIDER_PASSWORD` -- the provider account can read screening alerts
   from every family, so don't give it a password that's in the repo.
3. **API.** In Render: New > Blueprint > this repo. Paste `DATABASE_URL` when
   prompted. Note the service URL.
4. **Frontend.** In Vercel: Add New > Project > this repo, set **Root
   Directory** to `frontend`, add `NEXT_PUBLIC_API_URL` (the Render URL), and
   deploy. The build fails on purpose if the variable is missing or isn't
   `https://`. Note the Vercel URL.
5. **Close the loop.** Back in Render, add `CORS_ORIGINS` set to the Vercel
   URL. Render redeploys. Until this is set the API refuses all browser
   origins.
6. **Verify against the live URLs:**
   ```bash
   cd backend
   python scripts/smoke_test_live.py https://<api>.onrender.com \
     --frontend-origin https://<app>.vercel.app
   ```
   It registers throwaway accounts and checks the family-join flow, the
   vaccine schedule and growth, live care-log sync over `wss://`, booking
   against the seeded slots, screening, CORS and access control. Then open
   the Vercel URL in two browser tabs and watch a care-log entry appear in
   both. (The script leaves two test accounts behind and books one demo slot.)

Notes for a long-lived demo: seeded slots only cover the window set by
`DEMO_SLOT_DAYS` from the day the script runs. Re-run the script (it only
adds what's missing) to top them up. There's no cancel/reschedule endpoint,
so booked slots stay booked.

## Deploying the frontend

The live Vercel project (`nishtha15/nestpath`) isn't connected to GitHub, so
pushing to `main` does **not** redeploy the frontend. Deploy it from the
`frontend` folder with the Vercel CLI (the project's Root Directory is `.`, so
the folder you deploy from must be `frontend` itself):

```powershell
git fetch origin; git status            # be on main, level with origin/main, clean
cd frontend
vercel deploy --prod --project nestpath --scope nishtha15 --logs
```

- The build runs on Vercel, using the project's Production
  `NEXT_PUBLIC_API_URL`. Your local `frontend/.env.local` is never uploaded
  (Vercel's CLI skips it by default).
- `--project` and `--scope` pick the project directly, so there's no need for
  `vercel link` and no `.vercel/` folder is written.
- When it finishes, the output says `Aliased https://nestpath-one.vercel.app`
  and gives the new deployment id. `vercel inspect nestpath-one.vercel.app
  --scope nishtha15` confirms the domain points at it.

## Known limitations

This is a demo, not a production system. In particular:

- **The login token is in `sessionStorage`**, so any script running on the
  page -- for instance one injected through an XSS bug -- can read it. A
  production app would keep it in an `httpOnly`, `Secure`, `SameSite`
  cookie that scripts can't read, with short-lived access tokens renewed by
  refresh tokens.
- **Sessions last 60 minutes and there are no refresh tokens**, so you're
  signed out (cleanly, with a notice) once the token expires.
- **There is no rate limiting**, anywhere. That matters most for invite
  codes, which grant full access to a family's data: they're 8 characters
  from a 31-symbol alphabet (about 8.5 x 10^11 possibilities), which makes
  guessing impractical but not impossible when requests are unthrottled. Login
  and registration are unthrottled too.
- **The WebSocket token travels in the URL query string**, because browsers
  can't set an `Authorization` header on a WebSocket handshake. URLs end up in
  server, proxy and CDN logs. A production app would instead exchange the
  login for a short-lived, single-use ticket (or use the cookie above) to open
  the socket.
- **Live updates assume one backend instance.** Connections are tracked in the
  server's memory; running several instances would need a shared pub/sub such
  as Redis.

## Care log API

All family-scoped with the same rules as the rest of the API (another
family's child or entry is a 404). The interactive docs at `/docs` list
every field.

| Method and path | What it does |
|---|---|
| `POST /children/{id}/care-logs` | Add an entry: `type` (`feed`, `sleep`, `diaper`, `medication`), optional `occurred_at` (default now) and `notes`, plus the fields for its type: `feed_type`, `amount_ml` (1-500, bottle/solid), `duration_min` (1-180), `side` (breast); `ended_at` or `duration_min`, or `in_progress: true` for a running timer (sleep); `diaper_kind`. Fields of another type are rejected (422). A second running sleep is a 409. |
| `GET /children/{id}/care-logs` | Newest first. `limit`, `offset`, `type`, `from`, `to`. |
| `GET /children/{id}/care-logs/latest` | The newest feed, sleep, diaper and medication entry. |
| `GET /children/{id}/care-logs/summary?days=7\|30&tz=Area/City` | Per-day totals computed in SQL (feeds, ml, averages, diapers by kind, sleep minutes, longest stretch) and averages over the days with entries, both with today (`averages`) and without it (`averages_excluding_today`, which the app shows, since today is still in progress). Days are calendar days in `tz` (the browser's timezone; default UTC). A sleep across midnight is split between the days. |
| `PATCH /children/{id}/care-logs/{entry}` | Change any fields (null clears one); the whole entry is checked again. Stopping a timer is a PATCH with `ended_at`. |
| `DELETE /children/{id}/care-logs/{entry}` | Remove it (204). |
| `WS /ws/families/{family}?token=...` | Live changes: a created or updated entry as JSON with `"event": "created"` or `"updated"`; a deletion as `{"event": "deleted", "id", "deleted_from_child"}`. |

Entries made before the tracker (type and notes only) still list, update and
count as before; their structured fields are null.

## Creating new migrations

After changing a model in `backend/app/models.py`:

```bash
cd backend
python -m alembic revision --autogenerate -m "describe the change"
python -m alembic upgrade head
```

Always review autogenerated migrations before applying them -- Alembic does
not reliably detect every kind of change (e.g. it won't emit a `DROP TYPE`
for a removed Postgres enum on downgrade; see the initial migration for an
example fix).
