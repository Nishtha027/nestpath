"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LOGIN_HREF, REGISTER_HREF } from "@/lib/welcome";
import { Chick } from "../ui/illustrations";
import { TransitionLink } from "../ui/TransitionLink";
import { useMagnetic } from "./motion";
import { Roll } from "./Words";

const LINKS = [
  { href: "#live", label: "Live sync" },
  { href: "#features", label: "Features" },
  { href: "#built", label: "Under the hood" },
];

/** The landing page's floating header, plus a thin reading-progress line.
 * It slides away while you scroll down and comes back when you scroll up. */
export function LandingHeader() {
  const header = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const cta = useMagnetic<HTMLAnchorElement>(0.2);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const el = header.current;
      if (el) {
        const goingDown = y > lastY + 4;
        const goingUp = y < lastY - 4;
        if (y < 80 || goingUp) delete el.dataset.hidden;
        else if (goingDown && !el.contains(document.activeElement)) el.dataset.hidden = "";
        el.toggleAttribute("data-scrolled", y > 16);
      }
      if (Math.abs(y - lastY) > 4) lastY = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[3px]">
        <div ref={bar} className="h-full origin-left bg-linear-to-r from-lime via-night-blue to-chart-child" style={{ transform: "scaleX(0)" }} />
      </div>
      <header
        ref={header}
        className="np-header fixed inset-x-0 top-3 z-40 px-3 sm:top-4 sm:px-6"
      >
        <div className="np-glass mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-line py-1.5 pr-1.5 pl-3 np-header-bar">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full pr-2 font-heading text-xl font-semibold text-ink">
            <Chick animated className="h-9 w-9" />
            NestPath
          </Link>
          <nav aria-label="On this page" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="np-roll-host inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted transition-colors hover:bg-blue-soft hover:text-ink"
                  >
                    <Roll>{link.label}</Roll>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-1">
            <TransitionLink
              href={LOGIN_HREF}
              className="np-roll-host hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary-ink hover:bg-blue-soft sm:inline-flex"
            >
              <Roll>Log in</Roll>
            </TransitionLink>
            <TransitionLink
              ref={cta}
              href={REGISTER_HREF}
              className="np-magnetic np-roll-host inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-hover"
            >
              <Roll>Get started</Roll>
            </TransitionLink>
          </div>
        </div>
      </header>
    </>
  );
}
