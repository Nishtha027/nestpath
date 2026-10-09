"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { BUTTON_SECONDARY, INPUT } from "@/lib/ui";
import { BrandMark } from "../ui/BrandMark";

const CHILD_TABS = [
  { segment: "vaccines", label: "Vaccines" },
  { segment: "growth", label: "Growth" },
  { segment: "care-log", label: "Care log" },
  { segment: "appointments", label: "Appointments" },
] as const;

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
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-3 sm:px-8">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-lg font-bold text-ink">
          <BrandMark />
          NestPath
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {childList.length > 1 && selectedChild && (
            <label className="flex items-center gap-2">
              <span className="font-semibold text-muted">Child</span>
              <select
                value={selectedChild.id}
                onChange={(e) => handleChildChange(e.target.value)}
                className={`${INPUT} text-sm`}
              >
                {childList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name || "Unnamed child"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hidden text-muted sm:inline">{caregiver?.email}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className={BUTTON_SECONDARY}
          >
            Log out
          </button>
        </div>
      </div>
      <nav aria-label="Main" className="mx-auto w-full max-w-5xl px-2 sm:px-6">
        {/* Wraps onto a second row on narrow screens, so every label stays
            whole and visible; the padding keeps focus rings unclipped. */}
        <ul className="flex flex-wrap gap-1 whitespace-nowrap px-2 py-2.5">
          {tabs.map((tab) => (
            <li key={tab.label} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm sm:px-4 transition-colors ${
                  tab.active
                    ? "bg-blue-soft font-bold text-primary-ink"
                    : "font-medium text-muted hover:bg-page hover:text-ink"
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
