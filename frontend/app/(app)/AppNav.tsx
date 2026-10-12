"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { activeNavKey, navItems } from "@/lib/nav";
import { BUTTON_SECONDARY, INPUT } from "@/lib/ui";
import { Chick } from "../ui/illustrations";

export function AppNav() {
  const { caregiver, logout } = useAuth();
  const { childList, selectedChild, selectChild } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  // /children/{id}/{segment}
  const childRoute = pathname.match(/^\/children\/([^/]+)(?:\/([^/]+))?/);
  const routeSegment = childRoute?.[2] ?? null;

  // The same sections as the phone's bottom bar (lib/nav.ts).
  const activeKey = activeNavKey(pathname);
  const tabs = navItems(selectedChild?.id ?? null, Boolean(caregiver?.isProvider)).map((item) => ({
    ...item,
    active: item.key === activeKey,
  }));

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
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-8 md:pb-0 md:pt-3">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-heading text-xl font-semibold text-ink">
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
      {/* Wider screens only; phones get the bottom bar (BottomNav). */}
      <nav aria-label="Main" className="mx-auto hidden w-full max-w-5xl px-2 sm:px-6 md:block">
        {/* Wraps onto a second row if it must, so every label stays whole
            and visible; the padding keeps focus rings unclipped. */}
        <ul ref={listRef} className="relative flex flex-wrap gap-1 whitespace-nowrap px-2 py-2.5">
          <li aria-hidden="true" className="contents">
            <span
              ref={indicatorRef}
              className="np-tab-indicator pointer-events-none absolute top-0 left-0 rounded-full bg-blue-soft opacity-0"
            />
          </li>
          {tabs.map((tab) => (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-full px-3 text-sm sm:px-4 transition-colors ${
                  tab.active ? "font-bold text-primary-ink" : "font-semibold text-muted hover:bg-page hover:text-ink"
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
