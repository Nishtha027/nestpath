"use client";

import { useEffect, useRef } from "react";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCE = "(prefers-reduced-motion: reduce)";

/** A lime dot that trails the mouse and opens into a ring over links and
 * buttons. The system cursor stays as it is; this only follows it. Mouse
 * and trackpad only, and never with reduced motion. */
export function Follower() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia(FINE_POINTER).matches || matchMedia(REDUCE).matches) return;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let frame = 0;

    // Eases towards the pointer, and stops asking for frames once it is there.
    const tick = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if ("hidden" in el.dataset) {
        x = tx;
        y = ty;
        delete el.dataset.hidden;
      }
      const target = e.target instanceof Element ? e.target.closest("a, button, [data-cursor]") : null;
      el.toggleAttribute("data-hover", Boolean(target));
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      el.dataset.hidden = "";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" data-hidden="" className="np-follower">
      <span className="np-follower-dot" />
    </div>
  );
}
