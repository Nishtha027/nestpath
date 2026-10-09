"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Appointment, AvailabilitySlot, Provider } from "@/lib/types";
import { BUTTON_SECONDARY, CARD, FIELD, INPUT, LABEL, MUTED, SUBSECTION_TITLE } from "@/lib/ui";
import { Message } from "../../../ui/Message";
import { EmptyState } from "../../../ui/EmptyState";
import { Chick } from "../../../ui/illustrations";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Open slots grouped by local day, in time order: [["Thu, Oct 15", slots], ...]. */
function slotDays(slots: AvailabilitySlot[]): [string, AvailabilitySlot[]][] {
  const days = new Map<string, AvailabilitySlot[]>();
  for (const slot of [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const day = new Date(slot.start_time).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days];
}

export function Appointments({ childId, token }: { childId: string; token: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  const [booking, setBooking] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Provider[]>("/providers", { token })
      .then(setProviders)
      .catch((err) => setProvidersError(err instanceof ApiError ? err.message : "Couldn't load providers. Refresh to try again."));
  }, [token]);

  function loadAppointments() {
    apiFetch<Appointment[]>(`/children/${childId}/appointments`, { token })
      .then(setAppointments)
      .catch((err) =>
        setAppointmentsError(err instanceof ApiError ? err.message : "Couldn't load appointments. Refresh to try again.")
      );
  }

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, token]);

  useEffect(() => {
    // Nothing to reset here -- the slots list is only rendered when a
    // provider is selected, so a stale value sitting unused is harmless.
    if (!selectedProviderId) return;

    async function loadSlots() {
      setSlotsLoading(true);
      setSlotsError(null);
      try {
        setSlots(
          await apiFetch<AvailabilitySlot[]>(`/providers/${selectedProviderId}/availability`, { token })
        );
      } catch (err) {
        setSlotsError(err instanceof ApiError ? err.message : "Couldn't load open times. Try another provider or refresh.");
      } finally {
        setSlotsLoading(false);
      }
    }
    loadSlots();
  }, [selectedProviderId, token]);

  async function handleBook(slotId: string) {
    setBookError(null);
    setBooking(slotId);
    try {
      await apiFetch<Appointment>("/appointments", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, slot_id: slotId }),
      });
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      loadAppointments();
    } catch (err) {
      setBookError(err instanceof ApiError ? err.message : "Couldn't book that time. Try another.");
    } finally {
      setBooking(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD}>
        {providersError && <Message tone="error">{providersError}</Message>}
        {providers.length === 0 && !providersError ? (
          <p className={MUTED}>No providers yet.</p>
        ) : (
          <div className={FIELD}>
            <label htmlFor="appointment-provider" className={LABEL}>Provider</label>
            <select
              id="appointment-provider"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className={INPUT}
            >
              <option value="">Choose...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.specialty ? ` (${p.specialty})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedProviderId && (
          <div className="flex flex-col gap-2">
            {slotsLoading && <p className={MUTED}>Loading times...</p>}
            {slotsError && <Message tone="error">{slotsError}</Message>}
            {!slotsLoading && !slotsError && slots.length === 0 && (
              <p className={MUTED}>No open times.</p>
            )}
            {/* Open times grouped by day, as chips: one tap books, as before. */}
            <div className="flex flex-col gap-3 tabular-nums">
              {slotDays(slots).map(([day, daySlots]) => (
                <div key={day} className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-ink">{day}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <li key={slot.id}>
                        <button
                          type="button"
                          onClick={() => handleBook(slot.id)}
                          disabled={booking === slot.id}
                          aria-label={`Book ${day}, ${timeOf(slot.start_time)} to ${timeOf(slot.end_time)}`}
                          className={BUTTON_SECONDARY}
                        >
                          {booking === slot.id ? "Booking..." : timeOf(slot.start_time)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {bookError && <Message tone="error">{bookError}</Message>}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h2 className={SUBSECTION_TITLE}>Booked</h2>
        {appointmentsError && <Message tone="error">{appointmentsError}</Message>}
        {appointments.length === 0 && !appointmentsError && (
          <EmptyState art={<Chick className="h-20 w-20" />} title="No appointments yet">
            Choose a provider above to see open times.
          </EmptyState>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {appointments.map((appt) => (
            <li key={appt.id} className={`text-sm py-3 first:pt-0 last:pb-0`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-blue-soft px-2.5 py-0.5 font-bold capitalize text-primary-ink">
                  {appt.status}
                </span>
              </div>
              {appt.checklist.length > 0 && (
                <p className="mt-2 font-semibold text-ink">To ask</p>
              )}
              {appt.checklist.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink">
                  {appt.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
