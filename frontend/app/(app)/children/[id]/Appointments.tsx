"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Appointment, AvailabilitySlot, Provider } from "@/lib/types";

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
      .catch((err) => setProvidersError(err instanceof ApiError ? err.message : "Failed to load providers"));
  }, [token]);

  function loadAppointments() {
    apiFetch<Appointment[]>(`/children/${childId}/appointments`, { token })
      .then(setAppointments)
      .catch((err) =>
        setAppointmentsError(err instanceof ApiError ? err.message : "Failed to load appointments")
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
        setSlotsError(err instanceof ApiError ? err.message : "Failed to load availability");
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
      setBookError(err instanceof ApiError ? err.message : "Failed to book appointment");
    } finally {
      setBooking(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {providersError && <p className="text-sm text-red-600">{providersError}</p>}
        {providers.length === 0 && !providersError ? (
          <p className="text-sm text-zinc-500">No providers available yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Provider</label>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="rounded border px-3 py-2"
            >
              <option value="">Select a provider...</option>
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
            {slotsLoading && <p className="text-sm text-zinc-500">Loading availability...</p>}
            {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
            {!slotsLoading && !slotsError && slots.length === 0 && (
              <p className="text-sm text-zinc-500">No open slots for this provider.</p>
            )}
            <ul className="flex flex-col gap-2">
              {slots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >
                  <span>
                    {new Date(slot.start_time).toLocaleString()} &ndash;{" "}
                    {new Date(slot.end_time).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleBook(slot.id)}
                    disabled={booking === slot.id}
                    className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {booking === slot.id ? "Booking..." : "Book"}
                  </button>
                </li>
              ))}
            </ul>
            {bookError && <p className="text-sm text-red-600">{bookError}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-500">Upcoming appointments</h3>
        {appointmentsError && <p className="text-sm text-red-600">{appointmentsError}</p>}
        {appointments.length === 0 && !appointmentsError && (
          <p className="text-sm text-zinc-500">No appointments booked yet.</p>
        )}
        <ul className="flex flex-col gap-3">
          {appointments.map((appt) => (
            <li key={appt.id} className="rounded border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{appt.status}</span>
              </div>
              {appt.checklist.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-zinc-600 dark:text-zinc-400">
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
