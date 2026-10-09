import { ArtFrame, Cheek, Eye, Shadow, type ArtProps } from "./parts";

/** A duckling. Animated, it bobs gently (used while things load). */
export function Duckling({ className, animated = false }: ArtProps) {
  return (
    <ArtFrame className={className}>
      <Shadow cy={110} rx={28} />
      <g className={animated ? "np-loop-bob" : undefined}>
        {/* feet */}
        <ellipse cx="50" cy="106" rx="8" ry="4" fill="var(--np-art-beak)" />
        <ellipse cx="70" cy="106" rx="8" ry="4" fill="var(--np-art-beak)" />
        {/* body and wings */}
        <ellipse cx="60" cy="85" rx="30" ry="21" fill="var(--np-art-duck)" />
        <ellipse cx="33" cy="84" rx="7" ry="12" transform="rotate(28 33 84)" fill="var(--np-art-duck-deep)" />
        <ellipse cx="87" cy="84" rx="7" ry="12" transform="rotate(-28 87 84)" fill="var(--np-art-duck-deep)" />
        {/* head and tuft */}
        <ellipse cx="57.5" cy="25" rx="2.8" ry="6" transform="rotate(-24 57.5 25)" fill="var(--np-art-duck-deep)" />
        <ellipse cx="63" cy="24" rx="2.8" ry="7" transform="rotate(12 63 24)" fill="var(--np-art-duck-deep)" />
        <circle cx="60" cy="50" r="24" fill="var(--np-art-duck)" />
        {/* face */}
        <Eye x={50.5} y={47} />
        <Eye x={69.5} y={47} />
        <Cheek x={43} y={56} />
        <Cheek x={77} y={56} />
        <ellipse cx="60" cy="57" rx="9.5" ry="4.6" fill="var(--np-art-beak)" />
      </g>
    </ArtFrame>
  );
}
