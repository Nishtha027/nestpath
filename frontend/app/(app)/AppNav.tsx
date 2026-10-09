"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { BUTTON_SECONDARY, INPUT } from "@/lib/ui";
import { Chick } from "../ui/illustrations";

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

  // The active tab's pill is one element that slides between tabs. It is
  // positioned straight from the DOM (no state), and re-measured when the
  // bar resizes or wraps onto a second row.
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const activeIndex = tabs.findIndex((tab) => tab.active);
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    function place() {
      const link = activeIndex >= 0 ? list!.children[activeIndex + 1]?.firstElementChild : null;
      if (!(link instanceof HTMLElement)) {
        indicator!.style.opacity = "0";
        return;
      }
      const first = indicator!.style.opacity !== "1";
      // Appear in place the first time; slide after that.
      if (first) indicator!.style.transition = "none";
      indicator!.style.width = `${link.offsetWidth}px`;
      indicator!.style.height = `${link.offsetHeight}px`;
      indicator!.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
      indicator!.style.opacity = "1";
      if (first) {
        void indicator!.offsetWidth; // apply the jump before turning transitions back on
        indicator!.style.transition = "";
      }
    }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    for (const item of list.children) if (item.firstElementChild) observer.observe(item.firstElementChild);
    return () => observer.disconnect();
  }, [activeIndex, tabs.length]);

  function handleChildChange(childId: string) {
    selectChild(childId);
    // On a child tab, stay on the same tab for the newly chosen child.
    if (routeSegment) router.push(`/children/${childId}/${routeSegment}`);
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-3 sm:px-8">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-lg font-bold text-ink">
          <Chick className="h-9 w-9" />
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
        <ul ref={listRef} className="relative flex flex-wrap gap-1 whitespace-nowrap px-2 py-2.5">
          <li aria-hidden="true" className="contents">
            <span
              ref={indicatorRef}
              className="np-tab-indicator pointer-events-none absolute top-0 left-0 rounded-full bg-blue-soft opacity-0"
            />
          </li>
          {tabs.map((tab) => (
            <li key={tab.label} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-full px-3 text-sm sm:px-4 transition-colors ${
                  tab.active ? "font-bold text-primary-ink" : "font-medium text-muted hover:bg-page hover:text-ink"
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
