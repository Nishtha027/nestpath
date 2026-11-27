import type { ReactNode } from "react";
import { PAGE_TITLE } from "@/lib/ui";

/** The top of an app page: the title, set large with a lime full stop, and
 * one line on what the page is for. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="np-enter flex flex-col gap-2">
      <h1 className={PAGE_TITLE}>
        {title}
        <span aria-hidden="true" className="text-chart-child">
          .
        </span>
      </h1>
      {children && <p className="max-w-xl text-base text-muted">{children}</p>}
    </header>
  );
}
