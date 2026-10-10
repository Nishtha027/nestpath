import type { CSSProperties } from "react";
import Image from "next/image";
import { Sparkle } from "./parts";

// The welcome artwork: the image itself is shown exactly as supplied (never
// redrawn or edited), floating slowly as a whole. Around it, small original
// sparkles and hearts drift. All loops are off under reduced motion.

export const HERO_SRC = "/illustrations/hero-mother-child-blue-circle.png";
export const HERO_ALT = "A parent holding their child";
// The file's own pixel size, so the browser reserves the space up front.
const HERO_SIZE = 626;

/** A small rounded heart centered on (x, y). */
function Heart({ x, y, size, fill, className, style }: {
  x: number;
  y: number;
  size: number;
  fill: string;
  className?: string;
  style?: CSSProperties;
}) {
  const s = size / 2;
  return (
    <path
      className={className}
      style={style}
      fill={fill}
      d={`M${x} ${y + s} C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.9} ${y - s * 1.5} ${x} ${y - s * 0.55} C${x + s * 0.9} ${y - s * 1.5} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s} Z`}
    />
  );
}

const after = (s: number) => ({ animationDelay: `-${s}s` });

export function WelcomeHero({ animated = false }: { animated?: boolean }) {
  const loop = (name: string) => (animated ? name : undefined);
  return (
    <div className="relative mx-auto w-[300px] max-w-full lg:w-[420px]">
      <div className={loop("np-loop-float")}>
        <Image
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
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -inset-3 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)]"
      >
        <Sparkle x={8} y={14} size={2.6} fill="var(--np-art-petal-blue)" className={loop("np-loop-drift")} />
        <Sparkle x={91} y={9} size={2.2} fill="var(--np-art-petal-pink)" className={loop("np-loop-drift")} style={after(3)} />
        <Sparkle x={95} y={58} size={1.8} fill="var(--np-art-petal-blue)" className={loop("np-loop-drift")} style={after(6)} />
        <Sparkle x={4} y={62} size={2} fill="var(--np-art-petal-pink)" className={loop("np-loop-drift")} style={after(4.5)} />
        <Heart x={22} y={5} size={3.4} fill="var(--np-art-petal-pink)" className={loop("np-loop-drift")} style={after(1.5)} />
        <Heart x={97} y={34} size={2.8} fill="var(--np-art-petal-pink)" className={loop("np-loop-drift")} style={after(7)} />
        <Heart x={6} y={40} size={2.4} fill="var(--np-art-petal-blue)" className={loop("np-loop-drift")} style={after(5)} />
        <circle cx="78" cy="3" r="0.9" fill="var(--np-art-petal-blue)" className={loop("np-loop-drift")} style={after(2)} />
      </svg>
    </div>
  );
}
