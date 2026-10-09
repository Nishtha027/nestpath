"use client";

import { useRequireAuth } from "@/lib/auth-context";
import { AppStateProvider } from "@/lib/app-state";
import { AppNav } from "./AppNav";

// Every logged-in page renders inside this shell: one auth gate (with the
// existing redirect-to-/login and 401 handling from auth-context), one
// child list fetch, and the persistent tab bar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token } = useRequireAuth();
  if (!token) return null;

  return (
    <AppStateProvider key={token} token={token}>
      <div className="flex min-h-screen flex-col">
        <AppNav />
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </AppStateProvider>
  );
}
