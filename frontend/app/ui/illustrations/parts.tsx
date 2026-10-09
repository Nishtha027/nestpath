import type { CSSProperties, ReactNode } from "react";

// Shared pieces, so every character has the same face and the same
// flat, outline-free style. All colors are --np-art-* tokens.

export type ArtProps = {
  className?: string;
  /** Turn on the slow idle loop. Off by default: most places stay still. */
  animated?: boolean;
};

/** The <svg> wrapper: decorative, hidden from screen readers, no text. */
export function ArtFrame({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

/** Soft ground shadow under a character. */
export function Shadow({ cy = 108, rx = 36 }: { cy?: number; rx?: number }) {
  return <ellipse cx="60" cy={cy} rx={rx} ry="5" fill="var(--np-art-shadow)" />;
}

/** An open eye: a dark oval with a small shine. */
export function Eye({ x, y, blink = false }: { x: number; y: number; blink?: boolean }) {
  return (
    <g className={blink ? "np-loop-blink" : undefined}>
      <ellipse cx={x} cy={y} rx="3.4" ry="4.2" fill="var(--np-art-face)" />
      <circle cx={x + 1.1} cy={y - 1.5} r="1.2" fill="var(--np-art-shine)" />
    </g>
  );
}

/** A closed, resting eye: a gentle downward curve. */
export function ClosedEye({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 4} ${y} q4 3.6 8 0`}
      fill="none"
      stroke="var(--np-art-face)"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  );
}

/** A smiling eye: an upward curve. */
export function HappyEye({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 4} ${y + 1.5} q4 -4.6 8 0`}
      fill="none"
      stroke="var(--np-art-face)"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  );
}

export function Cheek({ x, y }: { x: number; y: number }) {
  return <ellipse cx={x} cy={y} rx="5" ry="3.2" fill="var(--np-art-cheek)" />;
}

/** A small closed smile centered on x. */
export function Smile({ x, y, width = 7 }: { x: number; y: number; width?: number }) {
  const h = width / 2;
  return (
    <path
      d={`M${x - h} ${y} q${h} ${h * 0.75} ${width} 0`}
      fill="none"
      stroke="var(--np-art-face)"
      strokeWidth="2"
      strokeLinecap="round"
    />
  );
}

/** A four-point sparkle centered on (x, y). */
export function Sparkle({
  x,
  y,
  size = 6,
  className,
  fill = "var(--np-art-sparkle)",
  style,
}: {
  x: number;
  y: number;
  size?: number;
  className?: string;
  fill?: string;
  style?: CSSProperties;
}) {
  const s = size;
  const k = s / 6;
  return (
    <path
      className={className}
      style={style}
      fill={fill}
      d={`M${x} ${y - s} Q${x + k} ${y - k} ${x + s} ${y} Q${x + k} ${y + k} ${x} ${y + s} Q${x - k} ${y + k} ${x - s} ${y} Q${x - k} ${y - k} ${x} ${y - s} Z`}
    />
  );
}
