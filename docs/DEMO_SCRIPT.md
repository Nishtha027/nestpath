# NestPath demo script (5 minutes)

A walkthrough of the live app in the order that tells the story best. **Do**
is what to click; **Say** is the talking point. Keep each step short; the
times are a guide.

Live app: https://nestpath-one.vercel.app
API docs: https://nestpath-api.onrender.com/docs

## Before the demo

### Accounts (set up once, yourself)

You need two caregiver accounts **in the same family** and, for the alerts
step, the provider account created by the seed script (its password is the
`DEMO_PROVIDER_PASSWORD` you chose when seeding; it is not in the repo).

1. Register caregiver A and add a baby (any name, a birth date about four
   months ago, so the vaccine page has overdue and closed doses).
2. On Home, copy the family's invite code.
3. Register caregiver B with that invite code.
4. Log a few feeds, sleeps and diapers so History and Insights aren't empty,
   and add two or three growth measurements.

Use made-up names only. Never use your real details in a demo account.

### Warm-up: 2 minutes before you start

The free tier sleeps, and a cold start takes up to a minute. Wake both
services first so nothing stalls on camera:

1. Open https://nestpath-api.onrender.com/health/ready and refresh until it
   shows `{"status":"ok"}`. That means the API **and** the database are up.
   (`/health` alone only proves the API is up.)
2. Open the app in **two windows side by side**: a normal window and a
   private window (or a second browser). Log caregiver A into the left one
   and caregiver B into the right one. Each tab keeps its own login.
3. In both, open Home. In the right window, open **History**.
4. Check that Appointments still has open slots. Seeded slots only cover the
   window set when the seed script last ran; if they've run out, re-run the
   seed (it only adds what's missing) before the demo.
5. Close other tabs and notifications, and zoom the browser to 110% or so.

## The walkthrough

### 0:00 Welcome (20 s)

**Do:** Start on the welcome page in the left window, then switch to Home.

**Say:** "NestPath is a shared companion app for new parents. One family
account holds the baby's vaccines, growth, a live baby tracker, appointments,
a postpartum check-in and a help board. It's Next.js on Vercel, FastAPI on
Render and Postgres on Neon, all on free tiers."

### 0:20 The live tracker: the two-window moment (60 s)

**Do:** In the left window (caregiver A), tap **Log**, choose Feed, Bottle,
enter 120 ml, and save. Point at the right window.

**Say:** "Caregiver B didn't refresh. The entry arrived over a WebSocket and
shows who logged it. The server only broadcasts after the database commit,
so nobody sees an entry that didn't save."

**Do:** In the right window, start a **sleep timer** from Log. Point back at
the left window's Home tile.

**Say:** "If the connection drops, the client reconnects with exponential
backoff and refetches the list, so a missed message never leaves a gap."

### 1:20 History and Insights (45 s)

**Do:** Open **History** (entries grouped by day, each with a short detail
line), then **Insights**.

**Say:** "Insights charts feeds, bottle amounts and sleep per day. Today's
bar is striped and labelled 'so far', and the averages leave today out, so
an unfinished day can't drag them down. It's numbers only; the app never
says an amount is too much or too little."

**Do (optional):** Open **Share with pediatrician** for the printable 7-day
summary.

### 2:05 Vaccines (40 s)

**Do:** Open **Vaccines**. Point at Overdue, then at "No longer recommended
at this age" (rotavirus), then mark one due dose done.

**Say:** "The schedule is the CDC one, encoded with its source and version.
Doses are due at the recommended age, and some vaccines have hard age limits;
past them the app says 'no longer recommended, ask your pediatrician'
instead of showing a catch-up dose that can't be given. Marking a dose done
re-plans the rest of the series from the real date, and it can be undone."

### 2:45 Growth (25 s)

**Do:** Open **Growth**.

**Say:** "Weight and length are scored against the WHO standards, the same
LMS method the WHO uses, and drawn on the percentile bands. Implausible
values are rejected, which catches kilograms typed as grams."

### 3:10 Appointments and the help board (35 s)

**Do:** Open **Appointments**, pick a provider and book a slot. Show the
visit checklist. Then open **Help board** and post a request in one window
and claim it from the other.

**Say:** "Booking and claiming both lock the row in Postgres
(`SELECT ... FOR UPDATE`), so if two people press at the same moment, one
wins and the other gets a conflict (409) instead of a double booking.
There's a concurrency test for each."

### 3:45 Wellbeing and the item-10 safety rule (60 s)

Show this calmly and say up front that the answers are scripted. Use a demo
account, never your own answers.

**Do:** In the left window open **Wellbeing**, then **Start check-in**.

**Say first:** "This is the Edinburgh Postnatal Depression Scale. I'm going
to answer with scripted demo answers to show one safety rule."

**Do:** Choose the lowest-scoring answer for every question (for items 3
and 5 to 10 that's the last option), except question 10: choose
**"Hardly ever"**. Submit.

**Say:** "The total score is 1, the lowest range. But question 10 asks about
self-harm, and any answer other than 'Never' is treated as high risk. That
rule runs on the server, so no client and no low total can hide it. The
result opens with crisis support first, the 988 line, before anything about
the score."

**Do (optional):** Log in as the provider account in a spare window and open
**Alerts**. The flagged result is there, without names or answers.

Note: there's no way to delete a check-in, so this demo result stays in the
alerts feed. That's another reason to use a dedicated demo account.

### 4:45 Close (15 s)

**Say:** "It's a portfolio project, not medical advice. The README covers the
architecture, the engineering decisions, the tests and the known
limitations."

## If something goes wrong

- **"NestPath is waking up"** appears: the warm-up was skipped or the
  services fell asleep. Keep talking; it resolves within a minute.
- **The second window doesn't update:** refresh it (it refetches on load),
  then mention the reconnect-and-refetch design.
- **No open slots in Appointments:** skip booking and show the existing
  booking's checklist instead.
