// The app's sections, in one list for both navigations: the top tabs on
// wider screens show them all; on phones the bottom bar shows the first
// four (Home, Log, History, Insights) and "More" opens a sheet with the
// rest. Tested in lib/nav.test.ts.

import type { IconName } from "../app/ui/Icon";

export type NavItem = { key: string; label: string; href: string; icon: IconName };

/** Sections that belong to a child, as /children/{id}/{segment}. */
const CHILD_SECTIONS: { key: string; label: string; icon: IconName }[] = [
  { key: "log", label: "Log", icon: "plusCircle" },
  { key: "history", label: "History", icon: "list" },
  { key: "insights", label: "Insights", icon: "barChart" },
  { key: "vaccines", label: "Vaccines", icon: "shield" },
  { key: "growth", label: "Growth", icon: "trendUp" },
  { key: "appointments", label: "Appointments", icon: "calendar" },
];

export const BOTTOM_BAR_KEYS = ["home", "log", "history", "insights"] as const;

/** Every section, in order. With no child yet, the child sections lead
 * Home, where a child is added. */
export function navItems(childId: string | null, isProvider: boolean): NavItem[] {
  return [
    { key: "home", label: "Home", href: "/dashboard", icon: "home" },
    ...CHILD_SECTIONS.map((section) => ({
      ...section,
      href: childId ? `/children/${childId}/${section.key}` : "/dashboard",
    })),
    { key: "wellbeing", label: "Wellbeing", href: "/wellbeing", icon: "heart" },
    { key: "help-board", label: "Help board", href: "/help-board", icon: "message" },
    ...(isProvider ? [{ key: "alerts", label: "Alerts", href: "/alerts", icon: "alertTriangle" as const }] : []),
  ];
}

/** Which section a path is in. The old care-log address is now History;
 * the pediatrician summary is opened from Appointments. */
export function activeNavKey(pathname: string): string | null {
  if (pathname === "/dashboard") return "home";
  const child = /^\/children\/[^/]+\/([^/]+)/.exec(pathname);
  if (child) {
    if (child[1] === "care-log") return "history";
    if (child[1] === "share") return "appointments";
    return CHILD_SECTIONS.some((s) => s.key === child[1]) ? child[1] : null;
  }
  for (const key of ["wellbeing", "help-board", "alerts"]) {
    if (pathname === `/${key}` || pathname.startsWith(`/${key}/`)) return key;
  }
  return null;
}

/** The bottom bar's items, and what goes in the More sheet. */
export function splitForBottomBar(items: NavItem[]): { bar: NavItem[]; more: NavItem[] } {
  const inBar = (item: NavItem) => (BOTTOM_BAR_KEYS as readonly string[]).includes(item.key);
  return { bar: items.filter(inBar), more: items.filter((item) => !inBar(item)) };
}
