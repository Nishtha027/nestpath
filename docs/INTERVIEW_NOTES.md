# NestPath: interview notes

For each major feature: the problem, the decision, the trade-off, and a
follow-up question an interviewer is likely to ask (with a short answer).
Everything here comes from the code and the commit history; commit hashes
are given where a decision was made.

## Families and access control

- **Problem.** Several caregivers share one baby's data, and no family may
  ever see another's.
- **Decision.** Every child-scoped route goes through one dependency,
  `get_child_for_caregiver` (`backend/app/deps.py`), which loads the child
  and compares its `family_id` with the caller's. A mismatch is a **404,
  not a 403**, so the API never confirms that an ID exists elsewhere.
  Joining uses an 8-character invite code (31-symbol alphabet with no
  look-alike characters), normalized on input.
- **Trade-off.** 404 makes debugging a permissions mistake slightly harder,
  since "not found" and "not yours" look the same. Invite codes are simple
  but not rate-limited, so they rely on their size alone.
- **Follow-up.** *"How would you add a second family per user, or
  per-child permissions?"* Replace `caregiver.family_id` with a membership
  table (caregiver, family, role) and make the dependency check membership;
  every route already goes through it, so that's one change.

## Vaccine timeline

- **Problem.** Parents want "what's due and when", and the official CDC
  schedule has recommended ages, minimum ages and intervals, and hard upper
  age limits.
- **Decision.** The schedule lives in `backend/reference-data/` with source
  URLs, retrieval dates and a `source_version`. Doses are due at the
  **recommended** age (or interval) and never before the minimum (6ce594c).
  Past a hard limit a dose becomes `age_window_closed` ("No longer
  recommended at this age") rather than overdue. Marking a dose given
  re-runs the catch-up plan from the real date; only the latest given dose
  of a vaccine can be undone (a 409 otherwise), so the series can't be left
  inconsistent. Schedule rows written by an older `source_version` are
  regenerated, with given doses untouched and the child row locked.
- **Trade-off.** Only the routine healthy-child US schedule is modelled
  (no risk-condition table, no Td/Tdap catch-up for ages 7 to 18), and
  month arithmetic uses fixed day counts except at the hard limits, which
  use calendar months. All of this is written down in the reference-data
  README.
- **Follow-up.** *"The CDC schedule changes. How do you roll that out?"*
  Bump `source_version`; the next schedule read regenerates every
  not-yet-given row for that child. Given doses are history and never
  change.

## Growth percentiles

- **Problem.** A raw weight means little to a parent; a percentile against
  a standard is the usual way to read it.
- **Decision.** The WHO LMS method with the WHO 2006 standards (L, M, S
  tables generated from CDC's mirror of the WHO files rather than retyped,
  and checked against the files' own percentile columns to 0.00001). Values
  outside WHO's plausibility limits are rejected with a 400 that names the
  unit (e022901). The chart draws the 3rd to 97th percentile bands, and the
  copy stresses a steady curve over the average line.
- **Trade-off.** Monthly tables only (0 to 24 months, whole months), no
  interpolation, because home-made interpolation could silently disagree
  with WHO's own software. Chronological age only, no correction for
  prematurity.
- **Follow-up.** *"Why reject implausible values instead of warning?"* The
  common cause is a unit slip (grams, inches), and a stored wrong value
  would poison the chart and every later percentile; a clear error at entry
  is cheaper than cleaning data later.

## Live shared baby tracker

- **Problem.** Two tired caregivers need to see the same feeds, sleeps and
  diapers instantly, on phones, on flaky connections.
- **Decision.**
  - REST for writes, a WebSocket per family for fan-out. The server
    broadcasts **after** the commit, so nobody sees an entry that didn't
    save.
  - The socket authenticates once with the JWT in the query string (browsers
    can't set headers on a WebSocket handshake). Its database session is
    closed right after that check, so an open socket holds no connection.
  - Bad auth is **accepted and then closed with 1008**. Closing before
    accept surfaces in browsers as a generic 1006, indistinguishable from a
    network drop, so the client would retry forever.
  - The client reconnects with exponential backoff (1 s up to 30 s, reset
    after a good connect), refetches the list after every connect to catch
    missed changes, and dedupes its own saves against pushes by id
    (ac33a2c, `frontend/lib/care-feed.tsx`).
  - Structured fields are nullable columns on the existing table, so
    entries from before the tracker still work (08d6ebf).
  - Validation gives one plain-English 422 per rule; at most one running
    sleep per child is enforced by a partial unique index.
- **Trade-off.** The connection registry is in memory, so it only works
  with one API instance. The token in the URL can end up in logs.
- **Follow-up.** *"How would you scale this to several instances?"* Publish
  each committed change to Redis (or Postgres `LISTEN/NOTIFY`) and have
  every instance fan out to its own sockets; replace the URL token with a
  short-lived, single-use ticket fetched over authenticated HTTP.

## Insights and the pediatrician summary

- **Problem.** Daily totals have to be right across midnight, time zones
  and daylight-saving changes, and a half-finished today shouldn't distort
  the averages.
- **Decision.** Aggregates are computed in SQL by calendar day in the
  **browser's** time zone (passed as an IANA name; never the server's). A
  sleep across midnight is split between the two days and a running sleep
  counts up to now. The API returns averages with and without today
  (`averages_excluding_today`, an additive field); the UI shows today as a
  striped "so far" bar and uses the without-today averages (c9a4c28). Tests
  cover New York midnight and the March DST change.
- **Trade-off.** A 30-day summary aggregates on every request instead of
  reading a stored rollup; fine at this size, and always consistent.
- **Follow-up.** *"Why compute in SQL rather than in Python or the
  browser?"* One query instead of shipping every entry, and the
  day-splitting rules live in one tested place that every client shares.

## Appointment booking

- **Problem.** Two parents (or two families) must never book the same slot.
- **Decision.** Lock the slot row with `SELECT ... FOR UPDATE` inside the
  booking transaction (`backend/app/services/booking.py`). The second
  request waits for the lock, then sees the slot is taken and gets a 409. A
  test fires two bookings at once from two threads behind a barrier and
  asserts exactly one wins (3972c1e). Each booking gets an age-bracketed
  visit-prep checklist.
- **Trade-off.** Pessimistic locking serializes contention on one slot;
  that's exactly the intent, and other slots are unaffected. There's no
  cancel or reschedule yet.
- **Follow-up.** *"Why not a unique constraint, or optimistic locking?"* A
  unique constraint on (slot) in an appointments table would also work and
  is a good second line of defence. The lock keeps the "is it free?" check
  and the write in one place with a clear error, and the same pattern is
  reused for help-board claims.

## Postpartum check-in (EPDS)

- **Problem.** A screening questionnaire touches a safety-critical case:
  item 10 asks about thoughts of self-harm.
- **Decision.** The published EPDS items and scoring, cited in code
  (563300e). On the **server**, `item_10_flag` is any item-10 score above 0,
  and `risk_level` is "high" whenever it's set, ORed onto the total-score
  band, so no total and no client can hide it. The total-score band is
  reported separately so the result can still describe the score honestly.
  The result page orders its sections from the server's flag: crisis
  support (988, 911) first, then "talk to someone today", never the
  low-band reassurance (545dea6). Flagged results reach a provider-only
  Alerts feed with IDs and scores, not names or answers. A test covers the
  low-total, item-10-flagged case.
- **Trade-off.** Any non-"Never" answer triggers the strongest response,
  which will sometimes over-escalate; for this item that's the right side
  to err on. The provider feed spans families by design, which the app
  tells the user before they start.
- **Follow-up.** *"What if the network fails after submit?"* The result
  comes from the server's response, so nothing is shown until it's stored;
  on an error the user sees the error and can resubmit. A future
  improvement would show the crisis lines on the error state too.

## Help board

- **Problem.** Friends offer help; the family needs a simple "who's bringing
  dinner" list without double-claiming.
- **Decision.** Same row lock as booking for claims, a 409 when it's
  already claimed, a 400 for claiming your own request, and family scoping
  through the same 404 rule (301c4b8). Concurrency test included.
- **Trade-off.** Claimers must be in the family; there's no lighter-weight
  "guest helper" role.
- **Follow-up.** *"How would you let a neighbour help without seeing the
  baby's data?"* A separate role or a per-request share link scoped to the
  help board only.

## Free-tier cold starts

- **Problem.** Render's free server sleeps after about 15 idle minutes and
  takes around 45 seconds to start; Neon suspends separately. The first
  login after a quiet spell used to fail.
- **Decision.** Every page pings `/health` (server) and `/health/ready`
  (`SELECT 1` with a 5-second limit) as soon as it opens; API requests wait
  for the server ping for up to 90 s; reads retry after 1 s and 3 s, but
  only on network errors and 5xx, never on a 4xx (so a 401 still signs out
  cleanly); the UI says "NestPath is waking up" after a few seconds
  (eeddd72, a67285e, b775ef6). The pool uses `pool_pre_ping` and recycles
  connections after 300 s. bcrypt's cost dropped from 12 to 10 because each
  login pays it on a tiny CPU; old hashes are upgraded on the next login
  (6280d73).
- **Trade-off.** A cold first visit is still slow; this hides failure, not
  latency. A paid instance or a keep-alive ping would remove it.
- **Follow-up.** *"Why not retry POSTs?"* They aren't idempotent; a retried
  booking or log entry could be applied twice.

## Deployment and migrations

- **Problem.** Three free services, deployed separately, with no downtime
  window.
- **Decision.** Expand-first migrations: new columns are nullable and old
  rows keep working, so the order is migrate, deploy the API, deploy the
  frontend, and each step is safe on its own. Migration tests run upgrade
  and downgrade on a real Postgres. CORS takes exact origins from an
  environment variable and fails closed when it's missing. The frontend
  build fails if the API URL isn't `https://`. The test suite refuses to
  run unless its database is local.
- **Trade-off.** The frontend is deployed by hand with the Vercel CLI, so
  a human can deploy from the wrong folder (it happened once; see the README
  warning and the `.vercelignore` files).
- **Follow-up.** *"What would CI look like?"* GitHub Actions running the
  backend suite against a Postgres service container and the frontend
  tests, types, lint and build on every pull request, then a connected
  Vercel project and Render auto-deploy from `main`.

## What I'd do next

1. **Auth hardening:** an `httpOnly` cookie session with refresh tokens,
   and a single-use ticket for the WebSocket instead of the token in the URL.
2. **Rate limiting** on login, registration and invite-code joins.
3. **Resilient broadcast:** today one failed `send_json` to a dead socket
   raises inside the broadcast loop after the commit; catch it per socket
   and drop that connection.
4. **Multi-instance live updates** through Redis or Postgres `LISTEN/NOTIFY`.
5. **CI and connected deploys**, plus end-to-end browser tests (Playwright)
   to replace the ad-hoc screenshot scripts.
6. **Corrected age** for babies born early, for both growth and the
   check-in prompts.
7. **Product gaps:** cancel and reschedule appointments, push notifications,
   support lines beyond the US, and calendar-exact month arithmetic in the
   vaccine schedule.

## The three hardest bugs

### 1. The WebSocket that reconnected forever (ac33a2c)

- **Symptom.** With an expired token, the live log would reconnect in a
  loop instead of signing the user out.
- **How it was found.** While building reconnect-with-backoff: a rejected
  token and a dropped network looked identical to the client. The commit
  records the browser check afterwards (a rejected token now ends in a
  clean logout with no retry loop).
- **Cause.** The server closed the socket *before* accepting it. That
  rejects the handshake with an HTTP 403, which browsers report as close
  code 1006, exactly what a network drop looks like, so the client
  correctly retried.
- **Fix.** Accept, then close with 1008 (policy violation). The client
  treats 1008 as final and signs out; everything else is retried with
  backoff.

### 2. A database session held open by every live socket (3972c1e)

- **Symptom.** Each connected WebSocket kept a database session open,
  idle in a transaction, for as long as the socket lived.
- **How it was found.** During the booking work (Phase 4a); the fix's
  comment records the effects: it can block unrelated DDL (such as the test
  suite dropping tables) and, with enough sockets, exhaust the connection
  pool. The commit doesn't record the exact moment it surfaced.
- **Cause.** The endpoint used the normal `Depends(get_db)` session, whose
  lifetime is the whole request, and for a WebSocket the "request" lasts
  until disconnect.
- **Fix.** Open a session just for the token check and close it straight
  away; the socket loop never touches the database.

### 3. Vaccines due at the wrong age (6ce594c)

- **Symptom.** MenACWY dose 1 showed as due at 2 months, and a 6-month-old
  was shown rotavirus dose 1 as an overdue catch-up dose.
- **How it was found.** By re-reading the CDC source pages table by table on
  2026-10-07 and checking the app against them. The tests had been written
  against the same understanding of the schedule, so it took a review of
  the source, not a test run, to catch it.
- **Cause.** Every dose had been scheduled at its catch-up table *minimum*
  age (MenACWY's 2-month minimum is for a high-risk-only product), and hard
  upper age limits weren't modelled at all.
- **Fix.** Due date is the recommended age or interval, never before the
  minimum; hard limits produce an `age_window_closed` status; the encoding
  got a new `source_version` and stale rows regenerate on the next read.
  New boundary tests (14 weeks 6 days vs 15 weeks 0 days, 8 months, ages 5
  and 7) now pin the rules.
