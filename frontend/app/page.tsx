"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; body: unknown }
  | { status: "error"; message: string };

export default function Home() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
        return res.json();
      })
      .then((body) => setHealth({ status: "ok", body }))
      .catch((err) =>
        setHealth({ status: "error", message: String(err) })
      );
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
      <h1 className="text-2xl font-semibold">NestPath</h1>
      <p className="text-sm text-zinc-500">
        Frontend &rarr; backend connectivity check ({API_URL}/health)
      </p>
      {health.status === "loading" && <p>Checking backend...</p>}
      {health.status === "ok" && (
        <pre className="rounded bg-black/[.06] px-4 py-2 font-mono text-sm dark:bg-white/[.08]">
          {JSON.stringify(health.body, null, 2)}
        </pre>
      )}
      {health.status === "error" && (
        <p className="text-red-600">
          Could not reach backend: {health.message}
        </p>
      )}
    </main>
  );
}
