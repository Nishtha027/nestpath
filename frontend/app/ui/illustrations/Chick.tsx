import { ArtFrame, Cheek, ClosedEye, Eye, Shadow, type ArtProps } from "./parts";

/** NestPath's chick, sitting in its nest. "resting" closes its eyes. */
export function Chick({ className, animated = false, resting = false }: ArtProps & { resting?: boolean }) {
  return (
    <ArtFrame className={className}>
      <Shadow cy={106} rx={42} />
      {/* back rim of the nest */}
      <ellipse cx="60" cy="76" rx="43" ry="10" fill="var(--np-art-nest-deep)" />
      <g className={animated ? "np-loop-breathe" : undefined}>
        {/* tuft */}
        <ellipse cx="56.5" cy="27" rx="3" ry="6.5" transform="rotate(-24 56.5 27)" fill="var(--np-art-chick-deep)" />
        <ellipse cx="62.5" cy="26" rx="3" ry="7.5" transform="rotate(14 62.5 26)" fill="var(--np-art-chick-deep)" />
        {/* wings, tucked behind the body */}
        <ellipse cx="32" cy="66" rx="7" ry="11" transform="rotate(24 32 66)" fill="var(--np-art-wing)" />
        <ellipse cx="88" cy="66" rx="7" ry="11" transform="rotate(-24 88 66)" fill="var(--np-art-wing)" />
        {/* body and belly */}
        <circle cx="60" cy="57" r="30" fill="var(--np-art-chick)" />
        <ellipse cx="60" cy="77" rx="18" ry="11" fill="var(--np-art-chick-light)" />
        {/* face */}
        {resting ? (
          <>
            <ClosedEye x={48.5} y={53} />
            <ClosedEye x={71.5} y={53} />
          </>
        ) : (
          <>
            <Eye x={49} y={52} blink={animated} />
            <Eye x={71} y={52} blink={animated} />
          </>
        )}
        <Cheek x={41.5} y={61} />
        <Cheek x={78.5} y={61} />
        <path d="M54.5 58.5 Q60 55.8 65.5 58.5 Q61.2 65 60 65 Q58.8 65 54.5 58.5 Z" fill="var(--np-art-beak)" />
      </g>
      {/* front of the nest, with a few twigs */}
      <path d="M15 76 Q60 96 105 76 Q103 102 60 105 Q17 102 15 76 Z" fill="var(--np-art-nest)" />
      <g fill="none" strokeWidth="2.5" strokeLinecap="round">
        <path d="M24 86 Q42 94 58 92" stroke="var(--np-art-nest-light)" />
        <path d="M64 96 Q82 95 96 86" stroke="var(--np-art-nest-light)" />
        <path d="M36 98 Q50 101 60 100" stroke="var(--np-art-nest-deep)" />
        <path d="M70 89 Q84 88 92 82" stroke="var(--np-art-nest-deep)" />
      </g>
    </ArtFrame>
  );
}
