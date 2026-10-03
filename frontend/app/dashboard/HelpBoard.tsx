"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { HelpRequest } from "@/lib/types";

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
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Need</label>
          <input
            type="text"
            placeholder="e.g. meal, errand, childcare"
            value={needType}
            onChange={(e) => setNeedType(e.target.value)}
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Details</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">From</label>
          <input
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Until</label>
          <input
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {creating ? "Posting..." : "Post request"}
        </button>
      </form>
      {createError && <p className="text-sm text-red-600">{createError}</p>}

      {loading && <p className="text-sm text-zinc-500">Loading...</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {!loading && !loadError && requests.length === 0 && (
        <p className="text-sm text-zinc-500">No open requests right now.</p>
      )}

      <ul className="flex flex-col gap-2">
        {requests.map((req) => {
          const isOwnRequest = req.created_by === caregiverId;
          return (
            <li
              key={req.id}
              className="flex flex-col gap-1 rounded border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="font-medium">{req.need_type}</span>
                {req.description && <span className="ml-2 text-zinc-500">{req.description}</span>}
                <div className="text-xs text-zinc-500">
                  {new Date(req.time_window_start).toLocaleString()} &ndash;{" "}
                  {new Date(req.time_window_end).toLocaleTimeString()}
                </div>
              </div>
              {isOwnRequest ? (
                <span className="text-xs text-zinc-500">You posted this -- someone else can claim it</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClaim(req.id)}
                  disabled={actioningId === req.id}
                  className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {actioningId === req.id ? "Claiming..." : "Claim"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {claimedByMe.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-zinc-500">Claimed by you</h3>
          <ul className="flex flex-col gap-2">
            {claimedByMe.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-1 rounded border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium">{req.need_type}</span>
                  {req.description && <span className="ml-2 text-zinc-500">{req.description}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleComplete(req.id)}
                  disabled={actioningId === req.id}
                  className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
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
