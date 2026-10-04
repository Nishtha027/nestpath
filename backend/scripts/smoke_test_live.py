"""End-to-end smoke test of a running NestPath API, local or deployed.

Walks the same path a visitor would -- register, create a child, vaccine
schedule + growth, a second caregiver joining by invite code, real-time
care-log sync over the WebSocket, booking against seeded data, a screening
-- and prints PASS/FAIL per check. Exits non-zero if anything failed.

    python scripts/smoke_test_live.py https://your-api.onrender.com \\
        --frontend-origin https://your-app.vercel.app

Needs httpx and websockets (both installed with requirements.txt). It talks
to the API only, so it checks the backend, CORS and the secure WebSocket
(wss:// when the URL is https://) but not the frontend's own pages -- open
those in a browser.

Side effects on the target database, which has no delete endpoints: two
throwaway accounts (smoke-<id>-a/b@example.com), one family and child, and
-- unless --skip-booking -- one booked appointment slot, which stays booked.
The screening it submits is deliberately low-risk, so the providers' Alerts
feed isn't polluted.
"""

import argparse
import asyncio
import json
import secrets
import sys
import time
from datetime import date, timedelta

import httpx
import websockets

# Answers that score 0 on the EPDS (reverse-scored items take the last option).
LOW_RISK_ANSWERS = [0, 0, 3, 0, 3, 3, 3, 3, 3, 3]

results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> bool:
    results.append((ok, name, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  -- {detail}" if detail and not ok else ""))
    return ok


def wait_for_health(client: httpx.Client, base: str, timeout_s: int = 150) -> bool:
    """Free-tier hosts sleep when idle and can take a minute to wake up."""
    print(f"Waking {base} (a cold start can take ~30-60s)...")
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            r = client.get(f"{base}/health", timeout=30)
            if r.status_code == 200 and r.json().get("status") == "ok":
                return True
        except (httpx.HTTPError, ValueError):
            pass
        time.sleep(3)
    return False


def register_and_login(client, base, name, email, password, invite_code=None):
    body = {"name": name, "email": email, "password": password}
    if invite_code:
        body["invite_code"] = invite_code
    reg = client.post(f"{base}/auth/register", json=body)
    if reg.status_code != 201:
        return None, reg
    login = client.post(f"{base}/auth/login", data={"username": email, "password": password})
    if login.status_code != 200:
        return None, login
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, reg


async def realtime_check(ws_base, family_id, token_a, token_b, post_log):
    """Both caregivers connect to the family's feed; one posts a care-log
    entry; both must receive it. Also: no token => the socket is refused.
    """
    url = f"{ws_base}/ws/families/{family_id}"
    async with websockets.connect(f"{url}?token={token_a}") as ws_a, websockets.connect(
        f"{url}?token={token_b}"
    ) as ws_b:
        await asyncio.sleep(0.5)  # let both registrations settle server-side
        marker = f"smoke-{secrets.token_hex(3)}"
        await asyncio.get_running_loop().run_in_executor(None, post_log, marker)
        received = []
        for ws in (ws_a, ws_b):
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                received.append(msg.get("notes") == marker)
            except (asyncio.TimeoutError, websockets.ConnectionClosed):
                received.append(False)
    both = all(received) and len(received) == 2
    check(both, "care-log entry reaches both caregivers' open sockets in real time",
          f"received={received}")

    try:
        async with websockets.connect(url) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
        refused = False
    except websockets.ConnectionClosed as exc:
        refused = exc.rcvd is not None and exc.rcvd.code == 1008
    except (websockets.InvalidStatus, OSError):
        refused = True
    except asyncio.TimeoutError:
        refused = False
    check(refused, "WebSocket without a token is refused")


def run(base: str, frontend_origin: str | None, skip_booking: bool) -> int:
    base = base.rstrip("/")
    ws_base = base.replace("http", "ws", 1)  # http -> ws, https -> wss
    run_id = secrets.token_hex(4)
    password = secrets.token_urlsafe(16)

    with httpx.Client(timeout=60) as client:
        print(f"\nSmoke test against {base}  (WebSocket: {ws_base.split(':')[0]}://)")
        if not check(wait_for_health(client, base), "API is up and /health is ok"):
            return 1

        if frontend_origin:
            print("\nCORS")
            allowed = client.options(
                f"{base}/auth/login",
                headers={"Origin": frontend_origin, "Access-Control-Request-Method": "POST"},
            )
            check(allowed.headers.get("access-control-allow-origin") == frontend_origin,
                  f"frontend origin {frontend_origin} is allowed",
                  f"got {allowed.headers.get('access-control-allow-origin')!r}")
            hostile = client.options(
                f"{base}/auth/login",
                headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
            )
            check("access-control-allow-origin" not in hostile.headers,
                  "an unrelated origin is NOT allowed")

        print("\nAccounts, family, child")
        headers_a, reg_a = register_and_login(
            client, base, "Smoke Parent A", f"smoke-{run_id}-a@example.com", password
        )
        if not check(headers_a is not None, "register + log in (new family)",
                     f"{reg_a.status_code} {reg_a.text[:120]}"):
            return 1
        family_id = reg_a.json()["family_id"]
        invite = client.get(f"{base}/family", headers=headers_a).json().get("invite_code")
        check(bool(invite) and len(invite) == 8, "family has an invite code")

        child = client.post(
            f"{base}/children",
            json={"name": "Smoke Baby", "birth_date": (date.today() - timedelta(days=60)).isoformat()},
            headers=headers_a,
        )
        if not check(child.status_code == 201, "create a child", child.text[:120]):
            return 1
        child_id = child.json()["id"]

        schedule = client.get(f"{base}/children/{child_id}/schedule", headers=headers_a).json()
        check(len(schedule) > 0 and any(i["vaccine_id"] == "dtap" for i in schedule),
              "vaccine schedule generated", f"{len(schedule)} items")

        growth = client.post(
            f"{base}/children/{child_id}/growth",
            json={"measured_at": date.today().isoformat(), "sex": "female", "weight_kg": 5.2},
            headers=headers_a,
        )
        points = client.get(f"{base}/children/{child_id}/growth", headers=headers_a).json()
        check(growth.status_code == 201 and len(points) == 1
              and isinstance(points[0]["percentile"], float),
              "growth measurement saved with a WHO percentile", growth.text[:120])

        print("\nSecond caregiver joins by invite code")
        headers_b, reg_b = register_and_login(
            client, base, "Smoke Parent B", f"smoke-{run_id}-b@example.com", password, invite_code=invite
        )
        if not check(headers_b is not None and reg_b.json().get("family_id") == family_id,
                     "register with invite code joins the same family",
                     f"{reg_b.status_code} {reg_b.text[:120]}"):
            return 1
        seen = client.get(f"{base}/children", headers=headers_b).json()
        check([c["id"] for c in seen] == [child_id], "second caregiver sees the child")
        bad = client.post(
            f"{base}/auth/register",
            json={"name": "X", "email": f"smoke-{run_id}-x@example.com", "password": password,
                  "invite_code": "ZZZZZZZZ"},
        )
        check(bad.status_code == 400, "a wrong invite code is rejected", str(bad.status_code))

        print("\nReal-time care log over the WebSocket")

        def post_log(marker: str):
            client.post(
                f"{base}/children/{child_id}/care-logs",
                json={"type": "feed", "notes": marker},
                headers=headers_a,
            )

        token_a = headers_a["Authorization"].split()[1]
        token_b = headers_b["Authorization"].split()[1]
        asyncio.run(realtime_check(ws_base, family_id, token_a, token_b, post_log))

        print("\nBooking against seeded data")
        providers = client.get(f"{base}/providers", headers=headers_a).json()
        if not check(len(providers) > 0, "seeded providers exist",
                     "none found -- run scripts/seed_demo_data.py against this database"):
            pass
        elif skip_booking:
            print("  skipped (--skip-booking)")
        else:
            slot = None
            for provider in providers:
                slots = client.get(f"{base}/providers/{provider['id']}/availability",
                                   headers=headers_a).json()
                if slots:
                    slot = slots[0]
                    break
            if check(slot is not None, "an open slot exists",
                     "no open slots -- re-run the seed script (it tops up; try DEMO_SLOT_DAYS=30)"):
                booked = client.post(f"{base}/appointments",
                                     json={"child_id": child_id, "slot_id": slot["id"]},
                                     headers=headers_a)
                check(booked.status_code == 201 and len(booked.json().get("checklist", [])) > 0,
                      "book it; a visit checklist is generated", booked.text[:120])
                again = client.post(f"{base}/appointments",
                                    json={"child_id": child_id, "slot_id": slot["id"]},
                                    headers=headers_b)
                check(again.status_code == 409, "booking the same slot again is refused (409)",
                      str(again.status_code))

        print("\nScreening and access control")
        screening = client.post(f"{base}/screenings", json={"answers": LOW_RISK_ANSWERS},
                                headers=headers_a)
        body = screening.json() if screening.status_code == 201 else {}
        check(screening.status_code == 201 and body.get("risk_level") == "low"
              and body.get("item_10_flag") is False,
              "screening submitted and scored", screening.text[:120])
        alerts = client.get(f"{base}/alerts", headers=headers_a)
        check(alerts.status_code == 403, "/alerts is refused for a non-provider (403)",
              str(alerts.status_code))
        anon = client.get(f"{base}/children")
        check(anon.status_code == 401, "endpoints require a login (401 without a token)",
              str(anon.status_code))

    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("api_url", help="base URL of the API, e.g. https://nestpath-api.onrender.com")
    parser.add_argument("--frontend-origin", help="the frontend's origin, to check CORS")
    parser.add_argument("--skip-booking", action="store_true",
                        help="don't book a slot (booked slots can't be released)")
    args = parser.parse_args()
    sys.exit(run(args.api_url, args.frontend_origin, args.skip_booking))
