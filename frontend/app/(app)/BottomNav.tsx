"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { activeNavKey, navItems, splitForBottomBar } from "@/lib/nav";
import { Icon } from "../ui/Icon";
import { Sheet, type SheetHandle } from "../ui/Sheet";

/** Phones only: a bar fixed to the bottom with Home, Log, History and
 * Insights, and More, which opens a sheet with every other section. Each
 * button is taller than a 44px tap target, and the bar sits above the
 * home indicator on phones that have one. */
export function BottomNav() {
  const { caregiver } = useAuth();
  const { selectedChild } = useAppState();
  const pathname = usePathname();
  const sheet = useRef<SheetHandle>(null);

  const { bar, more } = splitForBottomBar(navItems(selectedChild?.id ?? null, Boolean(caregiver?.isProvider)));
  const active = activeNavKey(pathname);
  const moreActive = more.some((item) => item.key === active);

  const tab = (isActive: boolean) =>
    `flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs ${
      isActive ? "font-bold text-primary-ink" : "font-semibold text-muted hover:text-ink"
    }`;
  const iconPill = (isActive: boolean) =>
    `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-blue-soft" : ""}`;

  return (
    <nav
      aria-label="Main"
      className="np-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-1">
        {bar.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <Link href={item.href} aria-current={isActive ? "page" : undefined} className={tab(isActive)}>
                <span className={iconPill(isActive)}>
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-current={moreActive ? "page" : undefined}
            onClick={() => sheet.current?.open()}
            className={tab(moreActive)}
          >
            <span className={iconPill(moreActive)}>
              <Icon name="more" className="h-5 w-5" />
            </span>
            More
          </button>
        </li>
      </ul>

      <Sheet ref={sheet} title="More">
        <ul className="grid grid-cols-2 gap-2">
          {more.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => sheet.current?.close()}
                  className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-sm ${
                    isActive
                      ? "border-primary-ink bg-blue-soft font-bold text-primary-ink"
                      : "border-line bg-surface font-semibold text-ink hover:bg-page"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </nav>
  );
}
