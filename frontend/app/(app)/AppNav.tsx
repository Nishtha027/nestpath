"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";

const CHILD_TABS = [
  { segment: "vaccines", label: "Vaccines" },
  { segment: "growth", label: "Growth" },
  { segment: "care-log", label: "Care log" },
  { segment: "appointments", label: "Appointments" },
] as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function AppNav() {
  const { caregiver, logout } = useAuth();
  const { childList, selectedChild, selectChild } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  // /children/{id}/{segment}
  const childRoute = pathname.match(/^\/children\/([^/]+)(?:\/([^/]+))?/);
  const routeSegment = childRoute?.[2] ?? null;

  const tabs: { href: string; label: string; active: boolean }[] = [
    { href: "/dashboard", label: "Home", active: pathname === "/dashboard" },
    ...CHILD_TABS.map((tab) => ({
      // With no children yet, child tabs lead Home, where a child is added.
      href: selectedChild ? `/children/${selectedChild.id}/${tab.segment}` : "/dashboard",
      label: tab.label,
      active: routeSegment === tab.segment,
    })),
    { href: "/wellbeing", label: "Wellbeing", active: pathname.startsWith("/wellbeing") },
    { href: "/help-board", label: "Help board", active: pathname.startsWith("/help-board") },
    ...(caregiver?.isProvider
      ? [{ href: "/alerts", label: "Alerts", active: pathname.startsWith("/alerts") }]
      : []),
  ];

  function handleChildChange(childId: string) {
    selectChild(childId);
    // On a child tab, stay on the same tab for the newly chosen child.
    if (routeSegment) router.push(`/children/${childId}/${routeSegment}`);
  }

  return (
    <header className="border-b border-black/10 bg-white dark:border-white/15 dark:bg-black">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-8">
        <Link href="/dashboard" className={`text-lg font-semibold ${FOCUS}`}>
          NestPath
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {childList.length > 1 && selectedChild && (
            <label className="flex items-center gap-2">
              <span className="text-zinc-600 dark:text-zinc-400">Child</span>
              <select
                value={selectedChild.id}
                onChange={(e) => handleChildChange(e.target.value)}
                className={`rounded border border-black/20 bg-white px-2 py-1 dark:border-white/25 dark:bg-zinc-900 ${FOCUS}`}
              >
                {childList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name || "Unnamed child"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">{caregiver?.email}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className={`rounded bg-black/[.06] px-3 py-1 hover:bg-black/[.1] dark:bg-white/[.08] dark:hover:bg-white/[.14] ${FOCUS}`}
          >
            Log out
          </button>
        </div>
      </div>
      <nav aria-label="Main" className="mx-auto w-full max-w-4xl px-4 sm:px-8">
        {/* Scrolls sideways on narrow screens instead of squashing the tabs. */}
        <ul className="-mb-px flex gap-1 overflow-x-auto whitespace-nowrap pt-2">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`inline-block rounded-t border-b-2 px-3 py-2 text-sm ${FOCUS} ${
                  tab.active
                    ? "border-blue-600 font-medium text-blue-700 dark:border-blue-400 dark:text-blue-300"
                    : "border-transparent text-zinc-700 hover:border-zinc-300 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
