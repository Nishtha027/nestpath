"use client";

import { useEffect } from "react";
import { MOTION_KEY, SAMPLE_MS, START_AFTER_MS, struggling } from "@/lib/motion-guard";

/** Keeps the idle animations cheap. Sets classes on <html> (see the np-loop
 * rules in globals.css): "np-paused" while the tab is hidden, and "np-lite"
 * when a short frame-time check shows the device can't keep up, which drops
 * the loops and keeps the entrances. Reduced motion is handled in CSS. */
export function MotionGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let timer = 0;
    let gaps: number[] = [];
    let start = 0;
    let last = 0;

    let decided: string | null = null;
    try {
      decided = sessionStorage.getItem(MOTION_KEY);
    } catch {}
    if (decided === "lite") root.classList.add("np-lite");
    const measure = decided === null && !matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tick = (now: number) => {
      if (start === 0) start = now;
      else gaps.push(now - last);
      last = now;
      if (now - start < SAMPLE_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const lite = struggling(gaps);
      root.classList.toggle("np-lite", lite);
      try {
        sessionStorage.setItem(MOTION_KEY, lite ? "lite" : "full");
      } catch {}
      decided = lite ? "lite" : "full";
    };
    const startSampling = () => {
      gaps = [];
      start = 0;
      timer = window.setTimeout(() => (raf = requestAnimationFrame(tick)), START_AFTER_MS);
    };
    const stopSampling = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };

    // A hidden tab gets no frames, so a sample is only fair while visible.
    const onVisibility = () => {
      root.classList.toggle("np-paused", document.hidden);
      if (!measure || decided !== null) return;
      if (document.hidden) stopSampling();
      else startSampling();
    };
    document.addEventListener("visibilitychange", onVisibility);
    root.classList.toggle("np-paused", document.hidden);
    if (measure && !document.hidden) startSampling();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopSampling();
    };
  }, []);
  return null;
}
