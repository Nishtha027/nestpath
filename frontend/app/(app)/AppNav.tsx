"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { activeNavKey, navItems } from "@/lib/nav";
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

  const initial = (caregiver?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="np-night sticky top-0 z-30 bg-night text-on-night print:hidden">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8 md:pt-4 md:pb-1">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-heading text-2xl font-semibold tracking-[-0.02em]">
          <Chick className="h-10 w-10" />
          <span>
            Nest<span className="text-night-yellow">Path</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {childList.length > 1 && selectedChild && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Child</span>
              <select
                value={selectedChild.id}
                onChange={(e) => handleChildChange(e.target.value)}
                className="min-h-11 rounded-full border border-night-line bg-night-raised px-4 text-sm font-bold text-on-night hover:border-night-yellow"
              >
                {childList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name || "Unnamed child"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hidden items-center gap-2 rounded-full border border-night-line py-1 pr-3 pl-1 text-night-muted sm:inline-flex">
            <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-night-pink font-bold text-ink">
              {initial}
            </span>
            {caregiver?.email}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="np-press inline-flex min-h-11 items-center rounded-full border border-night-line px-4 font-bold text-on-night hover:border-night-yellow hover:text-night-yellow"
          >
            Log out
          </button>
        </div>
      </div>
      {/* Wider screens only; phones get the bottom bar (BottomNav). */}
      <nav aria-label="Main" className="mx-auto hidden w-full max-w-4xl px-4 sm:px-8 md:block">
        {/* Wraps onto a second row if it must, so every label stays whole
            and visible; the padding keeps focus rings unclipped. */}
        <ul ref={listRef} className="relative -ml-3 flex flex-wrap gap-0.5 whitespace-nowrap pt-2 pb-3.5">
          <li aria-hidden="true" className="contents">
            <span
              ref={indicatorRef}
              className="np-tab-indicator pointer-events-none absolute top-0 left-0 rounded-full bg-night-yellow opacity-0"
            />
          </li>
          {tabs.map((tab) => (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-full px-3 text-sm sm:px-4 transition-colors ${
                  tab.active ? "font-bold text-night" : "font-semibold text-night-muted hover:bg-night-raised hover:text-on-night"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* A soft lip where the forest bar meets the page. */}
      <div aria-hidden="true" className="h-4 rounded-t-[1.5rem] bg-page" />
    </header>
  );
}
