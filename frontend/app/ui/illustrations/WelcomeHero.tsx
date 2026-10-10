"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// The welcome artwork: the image itself is shown exactly as supplied (never
// redrawn or edited), floating slowly as a whole. Around it, small original
// sparkles and hearts drift. All loops are off under reduced motion.
//
// Smoothness: everything that moves is its own HTML box animated with
// transform/opacity only, so the browser runs it on the compositor without
// repainting. Chrome never does that for SVG elements (not even an outer
// <svg>), so each SVG sits still inside a moving <span>.

export const HERO_SRC = "/illustrations/hero-mother-child-blue-circle.png";
export const HERO_ALT = "A parent holding their child";
// The file's own pixel size, so the browser reserves the space up front.
const HERO_SIZE = 626;
// Don't hold the picture back for long if decoding is slow or unsupported.
const DECODE_WAIT_MS = 1500;

type Piece = {
  shape: "sparkle" | "heart";
  /** Center, in % of the box around the picture. */
  x: number;
  y: number;
  /** Width, in % of that box. */
  size: number;
  color: "pink" | "blue";
  /** Seconds into its loop, so the pieces don't move in step. */
  offset: number;
  /** Drifts only on wider screens; still on phones, to run fewer loops. */
  minor?: boolean;
};

const PIECES: Piece[] = [
  { shape: "sparkle", x: 8, y: 14, size: 5, color: "blue", offset: 0 },
  { shape: "heart", x: 22, y: 5, size: 6, color: "pink", offset: 1.5, minor: true },
  { shape: "sparkle", x: 91, y: 9, size: 4.4, color: "pink", offset: 3 },
  { shape: "heart", x: 97, y: 34, size: 5, color: "pink", offset: 7 },
  { shape: "heart", x: 6, y: 40, size: 4.4, color: "blue", offset: 5, minor: true },
  { shape: "sparkle", x: 4, y: 62, size: 4, color: "pink", offset: 4.5 },
  { shape: "sparkle", x: 95, y: 58, size: 3.6, color: "blue", offset: 6 },
];

const SHAPES = {
  // Both drawn in a 20x20 box.
  sparkle: "M10 0 Q11.7 8.3 20 10 Q11.7 11.7 10 20 Q8.3 11.7 0 10 Q8.3 8.3 10 0 Z",
  heart: "M10 18 C-2 10 2 0 10 6.5 C18 0 22 10 10 18 Z",
};

export function WelcomeHero({ animated = false, revealDelayMs = 0 }: { animated?: boolean; revealDelayMs?: number }) {
  const img = useRef<HTMLImageElement>(null);
  // The rise-in waits until the picture is decoded, so the fade never
  // stutters on a half-decoded image.
  const [decoded, setDecoded] = useState(false);
  // Measured from page start, so a slow decode doesn't add to the delay.
  const [delayMs, setDelayMs] = useState(revealDelayMs);

  useEffect(() => {
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setDelayMs(Math.max(0, revealDelayMs - performance.now()));
      setDecoded(true);
    };
    const timer = setTimeout(reveal, DECODE_WAIT_MS);
    img.current?.decode().then(reveal, reveal);
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [revealDelayMs]);

  const loop = (name: string) => (animated ? name : "");
  return (
    <div
      className="np-reveal-art py-4"
      data-waiting={decoded ? undefined : ""}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative mx-auto w-[300px] max-w-full lg:w-[420px]">
        <div className={loop("np-loop-float")}>
          <Image
            ref={img}
            src={HERO_SRC}
            alt={HERO_ALT}
            width={HERO_SIZE}
            height={HERO_SIZE}
            sizes="(min-width: 1024px) 420px, 300px"
            preload
            className="block h-auto w-full"
          />
        </div>
        {/* sparkles and hearts drifting around the picture */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-3">
          {PIECES.map((p, i) => (
            // The <span> moves, not the <svg>: Chrome only runs transforms on
            // HTML boxes on the compositor, never on SVG elements.
            <span
              key={i}
              className={`absolute aspect-square ${loop(p.minor ? "np-loop-drift np-loop-minor" : "np-loop-drift")}`}
              style={{
                left: `${p.x - p.size / 2}%`,
                top: `${p.y}%`,
                width: `${p.size}%`,
                marginTop: `-${p.size / 2}%`,
                animationDelay: `-${p.offset}s`,
              }}
            >
              <svg viewBox="0 0 20 20" focusable="false" className="block h-full w-full">
                <path d={SHAPES[p.shape]} fill={`var(--np-art-petal-${p.color})`} />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
