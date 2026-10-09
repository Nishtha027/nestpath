"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { HelpRequest } from "@/lib/types";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, FIELD, INPUT, LABEL, LIST_ITEM, SUBSECTION_TITLE } from "@/lib/ui";
import { Message } from "../../ui/Message";
import { Loading } from "../../ui/Loading";
import { EmptyState } from "../../ui/EmptyState";
import { Duckling } from "../../ui/illustrations";

export function HelpBoard({ token, caregiverId }: { token: string; caregiverId: string }) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // GET /help-requests only returns OPEN requests for the family, so a
  // request claimed in this session (by this caregiver) is tracked here
  // separately -- otherwise it would just vanish from view with no way
  // to mark it complete.
  const [claimedByMe, setClaimedByMe] = useState<HelpRequest[]>([]);

  const [needType, setNeedType] = useState("");
  const [description, setDescription] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadRequests() {
    // No synchronous setLoading(true) here -- the initial state already
    // covers first render, and later refreshes (after create/claim/
    // complete) shouldn't flash "Loading..." over an already-populated list.
    apiFetch<HelpRequest[]>("/help-requests", { token })
      .then(setRequests)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load help requests"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await apiFetch<HelpRequest>("/help-requests", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          need_type: needType,
          description: description || null,
          time_window_start: new Date(windowStart).toISOString(),
          time_window_end: new Date(windowEnd).toISOString(),
        }),
      });
      setNeedType("");
      setDescription("");
      setWindowStart("");
      setWindowEnd("");
      loadRequests();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create help request");
    } finally {
      setCreating(false);
    }
  }

  async function handleClaim(id: string) {
    setActionError(null);
    setActioningId(id);
    try {
      const claimed = await apiFetch<HelpRequest>(`/help-requests/${id}/claim`, {
        token,
        method: "POST",
      });
      setClaimedByMe((prev) => [...prev, claimed]);
      loadRequests();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to claim request");
      loadRequests();
    } finally {
      setActioningId(null);
    }
  }

  async function handleComplete(id: string) {
    setActionError(null);
    setActioningId(id);
    try {
      await apiFetch(`/help-requests/${id}/complete`, { token, method: "POST" });
      setClaimedByMe((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete request");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleCreate} className={`${CARD} sm:grid sm:grid-cols-2 sm:items-end`}>
        <div className={FIELD}>
          <label htmlFor="help-need" className={LABEL}>Need</label>
          <input
            id="help-need"
            type="text"
            placeholder="e.g. meal, errand, childcare"
            value={needType}
            onChange={(e) => setNeedType(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="help-details" className={LABEL}>Details</label>
          <input
            id="help-details"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="help-from" className={LABEL}>From</label>
          <input
            id="help-from"
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="help-until" className={LABEL}>Until</label>
          <input
            id="help-until"
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className={`${BUTTON_PRIMARY} sm:col-span-2 sm:justify-self-start`}
        >
          {creating ? "Posting..." : "Post request"}
        </button>
      </form>
      {createError && <Message tone="error">{createError}</Message>}

      {loading && <Loading />}
      {loadError && <Message tone="error">{loadError}</Message>}
      {actionError && <Message tone="error">{actionError}</Message>}
      {!loading && !loadError && requests.length === 0 && (
        <div className="np-enter rounded-2xl border border-line bg-surface">
          <EmptyState art={<Duckling className="h-20 w-20" />} title="No open requests right now.">
            When someone in your family needs a hand with a meal, an errand or childcare, their
            request shows up here for the others to claim.
          </EmptyState>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {requests.map((req) => {
          const isOwnRequest = req.created_by === caregiverId;
          return (
            <li
              key={req.id}
              className={`flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between ${LIST_ITEM}`}
            >
              <div>
                <span className="font-bold">{req.need_type}</span>
                {req.description && <span className="ml-2 text-ink">{req.description}</span>}
                <div className="text-xs text-muted">
                  {new Date(req.time_window_start).toLocaleString()} &ndash;{" "}
                  {new Date(req.time_window_end).toLocaleTimeString()}
                </div>
              </div>
              {isOwnRequest ? (
                <span className="rounded-full bg-pink-soft px-3 py-1 text-xs font-semibold text-secondary-ink">
                  You posted this -- someone else can claim it
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClaim(req.id)}
                  disabled={actioningId === req.id}
                  className={BUTTON_SECONDARY}
                >
                  {actioningId === req.id ? "Claiming..." : "Claim"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {claimedByMe.length > 0 && (
        <div className={CARD}>
          <h3 className={SUBSECTION_TITLE}>Claimed by you</h3>
          <ul className="flex flex-col gap-2">
            {claimedByMe.map((req) => (
              <li
                key={req.id}
                className={`flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between ${LIST_ITEM}`}
              >
                <div>
                  <span className="font-bold">{req.need_type}</span>
                  {req.description && <span className="ml-2 text-ink">{req.description}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleComplete(req.id)}
                  disabled={actioningId === req.id}
                  className={BUTTON_PRIMARY}
                >
                  {actioningId === req.id ? "Completing..." : "Mark complete"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
