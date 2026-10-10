import { useId } from "react";
import { Sparkle } from "./parts";

// The welcome scene: a parent cradling a swaddled baby, with leaves and
// flowers. Faceless on purpose, flat rounded shapes, colors from the
// --np-art-* tokens. Decorative only. With `animated`, the leaves sway, the
// pair breathes and a few sparkles drift (all slow loops, off under reduced
// motion).

/** A five-petal flower centered on (x, y). */
export function Flower({ x, y, r = 7, petal }: { x: number; y: number; r?: number; petal: string }) {
  const petals = [0, 72, 144, 216, 288].map((deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return <circle key={deg} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} r={r * 0.82} fill={petal} />;
  });
  return (
    <g>
      {petals}
      <circle cx={x} cy={y} r={r * 0.62} fill="var(--np-art-petal-center)" />
    </g>
  );
}

/** A leaf pointing up from (x, y), `len` long, tilted by `angle` degrees. */
export function Leaf({
  x,
  y,
  len,
  angle,
  fill = "var(--np-art-leaf)",
}: {
  x: number;
  y: number;
  len: number;
  angle: number;
  fill?: string;
}) {
  const w = len * 0.42;
  return (
    <path
      transform={`rotate(${angle} ${x} ${y})`}
      fill={fill}
      d={`M${x} ${y} C${x - w} ${y - len * 0.3} ${x - w * 0.7} ${y - len * 0.85} ${x} ${y - len} C${x + w * 0.7} ${y - len * 0.85} ${x + w} ${y - len * 0.3} ${x} ${y} Z`}
    />
  );
}

/** A sprig growing up from (x, y): a curved stem with leaves along it.
 * `flip` mirrors it so the two sides of a scene match. */
export function Sprig({
  x,
  y,
  flip = false,
  className,
}: {
  x: number;
  y: number;
  flip?: boolean;
  className?: string;
}) {
  return (
    // The mirror goes on an outer group: a CSS animation on the same element
    // would replace the transform attribute.
    <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
      <g className={className}>
      <path
        d={`M${x} ${y} C${x - 4} ${y - 40} ${x - 14} ${y - 76} ${x - 30} ${y - 104}`}
        fill="none"
        stroke="var(--np-art-stem)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Leaf x={x - 2} y={y - 24} len={34} angle={-58} fill="var(--np-art-leaf-deep)" />
      <Leaf x={x - 4} y={y - 34} len={30} angle={38} />
      <Leaf x={x - 11} y={y - 62} len={30} angle={-62} />
      <Leaf x={x - 14} y={y - 70} len={26} angle={28} fill="var(--np-art-leaf-deep)" />
      <Leaf x={x - 30} y={y - 103} len={26} angle={-24} />
      </g>
    </g>
  );
}

export function ParentAndBaby({ className, animated = false }: { className?: string; animated?: boolean }) {
  const loop = (name: string) => (animated ? name : undefined);
  // The pair sits inside the round backdrop, cut off by its lower edge.
  const clip = useId();
  return (
    <svg viewBox="0 36 400 384" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <clipPath id={clip}>
          <circle cx="200" cy="212" r="168" />
        </clipPath>
      </defs>
      <circle cx="200" cy="212" r="168" fill="var(--np-art-backdrop)" />

      {/* drifting sparkles and dots */}
      <g fill="var(--np-art-petal-pink)">
        <Sparkle x={58} y={96} size={9} className={loop("np-loop-drift")} />
        <Sparkle x={344} y={70} size={7} fill="var(--np-art-sparkle)" className={loop("np-loop-drift")} style={{ animationDelay: "-3s" }} />
        <circle cx="330" cy="140" r="5" className={loop("np-loop-drift")} style={{ animationDelay: "-5s" }} />
        <circle cx="86" cy="46" r="4" fill="var(--np-art-petal-blue)" className={loop("np-loop-drift")} style={{ animationDelay: "-1.5s" }} />
      </g>

      <g clipPath={`url(#${clip})`}>
        {/* parent and baby, breathing together */}
        <g className={loop("np-loop-breathe-soft")}>
          {/* parent: body, then the neck and head bowed toward the baby */}
          <path
            d="M118 420 C116 330 122 268 150 250 C170 237 196 230 222 230 C248 230 274 237 294 250 C322 268 328 330 326 420 Z"
            fill="var(--np-art-top)"
          />
          <g transform="rotate(-14 234 236)">
            <rect x="214" y="188" width="40" height="54" rx="18" fill="var(--np-art-skin)" />
            <circle cx="234" cy="164" r="42" fill="var(--np-art-skin)" />
            <path
              d="M190 168 C186 130 208 114 235 114 C264 114 282 132 278 166 C270 148 252 140 232 143 C214 146 200 155 190 168 Z"
              fill="var(--np-art-hair)"
            />
          </g>

          <path d="M204 236 Q232 254 262 234" fill="none" stroke="var(--np-art-top-deep)" strokeWidth="9" strokeLinecap="round" />

          {/* baby, held upright against the chest */}
          <rect x="126" y="236" width="104" height="126" rx="46" fill="var(--np-art-wrap)" />
          <path d="M140 300 Q180 316 222 298" fill="none" stroke="var(--np-art-wrap-fold)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="176" cy="216" r="36" fill="var(--np-art-skin-light)" />
          <path d="M140 214 C140 188 156 178 176 178 C196 178 212 188 212 214 Z" fill="var(--np-art-chick)" />
          <circle cx="176" cy="174" r="8" fill="var(--np-art-chick-deep)" />

          {/* parent: arms around the baby, one under it, one across its back */}
          <path
            d="M146 256 C118 276 106 318 116 344 C128 368 172 362 210 348"
            fill="none"
            stroke="var(--np-art-top-deep)"
            strokeWidth="27"
            strokeLinecap="round"
          />
          <ellipse cx="214" cy="346" rx="16" ry="13" fill="var(--np-art-skin)" />
          <path
            d="M298 256 C328 276 338 314 326 336 C310 358 254 328 222 306"
            fill="none"
            stroke="var(--np-art-top-deep)"
            strokeWidth="27"
            strokeLinecap="round"
          />
          <ellipse cx="212" cy="298" rx="16" ry="13" fill="var(--np-art-skin)" transform="rotate(36 212 298)" />
        </g>
      </g>

      {/* leaves and flowers in front, swaying */}
      <Sprig x={78} y={404} className={loop("np-loop-sway")} />
      <Sprig x={322} y={404} flip className={loop("np-loop-sway-back")} />
      <Flower x={46} y={376} r={8} petal="var(--np-art-petal-pink)" />
      <Flower x={356} y={368} r={7} petal="var(--np-art-petal-blue)" />
      <Flower x={118} y={392} r={6} petal="var(--np-art-petal-blue)" />
      <Flower x={286} y={394} r={6} petal="var(--np-art-petal-pink)" />
    </svg>
  );
}
