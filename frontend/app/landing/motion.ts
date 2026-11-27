"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";

// Small hooks behind the landing page's motion. None of them animate
// anything themselves: they set data attributes and CSS variables, and the
// np-* classes in app/globals.css do the moving (so the reduced-motion block
// there switches all of it off).

const REDUCE = "(prefers-reduced-motion: reduce)";
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mq = matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
}
const subscribeReduce = subscribeMedia(REDUCE);

/** True when the visitor asked for less motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduce,
    () => matchMedia(REDUCE).matches,
    () => false
  );
}

/** Whether a media query matches, kept up to date. False on the server. */
export function useMedia(query: string): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false
  );
}

/** Watches every [data-reveal] inside the root and sets data-in on each
 * one the first time it scrolls into view. One observer for the page. */
export function useScrollReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.in = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [root]);
}

/** Whether the element is on screen (kept up to date both ways), for demos
 * that should only run while someone can see them. */
export function useInView<T extends Element>(rootMargin = "0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, inView] as const;
}

/** Steps through a scripted demo: step i lasts durations[i] ms, then the
 * next one starts, and it loops. Runs only while `active` (on screen, tab
 * visible). With reduced motion it holds on `still`, the finished state. */
export function useDemoSteps(durations: number[], active: boolean, still: number): number {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % durations.length), durations[step]);
    return () => clearTimeout(timer);
  }, [reduce, active, step, durations]);
  return reduce ? still : step;
}

/** Ticks once every `ms` while active; returns how many ticks so far. */
export function useTicker(ms: number, active: boolean): number {
  const reduce = useReducedMotion();
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    const timer = window.setInterval(() => setTicks((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [reduce, active, ms]);
  return ticks;
}

/** Pointer parallax for the hero: writes --px and --py (-1 to 1, from the
 * centre) on the element, once per frame at most. Mouse and trackpad only. */
export function usePointerParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia(FINE_POINTER).matches || matchMedia(REDUCE).matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const write = () => {
      frame = 0;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      x = ((e.clientX - box.left) / box.width) * 2 - 1;
      y = ((e.clientY - box.top) / box.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(write);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [ref]);
}

/** A button that leans a little towards the pointer (the np-magnetic class
 * reads --mx and --my). */
export function useMagnetic<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia(FINE_POINTER).matches || matchMedia(REDUCE).matches) return;
    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      el.style.setProperty("--mx", `${(dx * strength).toFixed(1)}px`);
      el.style.setProperty("--my", `${(dy * strength * 1.2).toFixed(1)}px`);
    };
    const onLeave = () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);
  return ref;
}

/** Cards in a grid that light up where the pointer is: writes --sx and --sy
 * on whichever .np-spotlight card is under it. */
export function useSpotlight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia(FINE_POINTER).matches) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element).closest<HTMLElement>(".np-spotlight");
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--sx", `${e.clientX - box.left}px`);
      card.style.setProperty("--sy", `${e.clientY - box.top}px`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [ref]);
}

/** Counts up to `to` once the element scrolls into view. */
export function useCountUp(to: number, durationMs = 1600) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  const finished = value === to;
  useEffect(() => {
    // Leaving the screen part-way stops it; coming back starts it again.
    if (reduce || !inView || finished) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, to, durationMs, finished]);
  return [ref, reduce ? to : value] as const;
}
