import threading
from datetime import date, datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Appointment, AvailabilitySlot, Child, Provider
from app.services.booking import SlotAlreadyBookedError, generate_checklist, book_slot


def test_checklist_generation_varies_by_age():
    birth_date = date(2026, 1, 1)

    two_week = generate_checklist(birth_date, birth_date + timedelta(days=14))
    two_month = generate_checklist(birth_date, birth_date + timedelta(days=60))
    twelve_month = generate_checklist(birth_date, birth_date + timedelta(days=365))
    toddler = generate_checklist(birth_date, birth_date + timedelta(days=900))

    assert two_week != two_month
    assert two_month != twelve_month
    assert twelve_month != toddler
    assert all(isinstance(q, str) and q for q in two_week)
    assert all(isinstance(q, str) and q for q in toddler)


def test_checklist_generation_is_deterministic_for_same_age():
    birth_date = date(2026, 1, 1)
    assert generate_checklist(birth_date, birth_date + timedelta(days=60)) == generate_checklist(
        birth_date, birth_date + timedelta(days=60)
    )


def _create_provider_and_slot(db_session):
    provider = Provider(name="Dr. Test", specialty="Pediatrics")
    db_session.add(provider)
    db_session.flush()
    slot = AvailabilitySlot(
        provider_id=provider.id,
        start_time=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 10, 1, 9, 30, tzinfo=timezone.utc),
    )
    db_session.add(slot)
    db_session.commit()
    return provider, slot


def test_availability_endpoint_excludes_booked_slots(client, auth_headers, db_session):
    headers, _ = auth_headers()
    provider, slot = _create_provider_and_slot(db_session)

    resp = client.get(f"/providers/{provider.id}/availability", headers=headers)
    assert resp.status_code == 200
    assert [s["id"] for s in resp.json()] == [str(slot.id)]

    slot.is_booked = True
    db_session.commit()

    resp = client.get(f"/providers/{provider.id}/availability", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_booking_a_slot_generates_checklist_and_appears_in_appointments(client, auth_headers, db_session):
    headers, _ = auth_headers()
    child_resp = client.post("/children", json={"birth_date": "2026-01-01"}, headers=headers)
    assert child_resp.status_code == 201
    child_id = child_resp.json()["id"]

    provider, slot = _create_provider_and_slot(db_session)

    resp = client.post("/appointments", json={"child_id": child_id, "slot_id": str(slot.id)}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["child_id"] == child_id
    assert body["slot_id"] == str(slot.id)
    assert body["status"] == "booked"
    assert body["checklist"] == generate_checklist(date(2026, 1, 1), date(2026, 10, 1))

    list_resp = client.get(f"/children/{child_id}/appointments", headers=headers)
    assert list_resp.status_code == 200
    assert [a["id"] for a in list_resp.json()] == [body["id"]]

    # A second booking attempt for the same (now-booked) slot is rejected.
    second = client.post("/appointments", json={"child_id": child_id, "slot_id": str(slot.id)}, headers=headers)
    assert second.status_code == 409


def test_concurrent_booking_requests_only_one_succeeds(client, auth_headers, db_session):
    headers, register = auth_headers()
    child_resp = client.post("/children", json={"birth_date": "2026-01-01"}, headers=headers)
    assert child_resp.status_code == 201
    child_id = child_resp.json()["id"]

    _, slot = _create_provider_and_slot(db_session)
    slot_id = slot.id
    caregiver_id = register["id"]

    barrier = threading.Barrier(2)
    results: list[str] = [None, None]  # type: ignore[list-item]

    def attempt(index: int):
        session = SessionLocal()
        try:
            child = session.get(Child, child_id)
            barrier.wait(timeout=10)
            try:
                book_slot(session, slot_id, child, caregiver_id)
                session.commit()
                results[index] = "booked"
            except SlotAlreadyBookedError:
                session.rollback()
                results[index] = "conflict"
        except Exception as exc:  # surfaces unexpected errors instead of a silent None
            results[index] = f"error: {exc!r}"
        finally:
            session.close()

    t1 = threading.Thread(target=attempt, args=(0,))
    t2 = threading.Thread(target=attempt, args=(1,))
    t1.start()
    t2.start()
    t1.join(timeout=15)
    t2.join(timeout=15)

    assert sorted(results) == ["booked", "conflict"], results

    db_session.expire_all()
    appointments = db_session.query(Appointment).filter(Appointment.slot_id == slot_id).all()
    assert len(appointments) == 1
