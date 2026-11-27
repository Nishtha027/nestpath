import { ArtFrame, Cheek, ClosedEye, Eye } from "./parts";

/** The chick out of its nest, on two little feet: it walks the path down
 * the landing page. Still on its own; FeaturePath moves the box around it.
 * "resting" closes its eyes (it does that while passing Wellbeing). */
export function ChickWalker({ className, resting = false }: { className?: string; resting?: boolean }) {
  return (
    <ArtFrame className={className}>
      <ellipse cx="60" cy="112" rx="26" ry="4.5" fill="var(--np-art-shadow)" />
      {/* feet */}
      <g fill="none" stroke="var(--np-art-beak)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 92 L48 108 M42 109 L48 108 L53 110" />
        <path d="M70 92 L72 108 M67 110 L72 108 L78 109" />
      </g>
      {/* tuft */}
      <ellipse cx="56.5" cy="23" rx="3" ry="6.5" transform="rotate(-24 56.5 23)" fill="var(--np-art-chick-deep)" />
      <ellipse cx="62.5" cy="22" rx="3" ry="7.5" transform="rotate(14 62.5 22)" fill="var(--np-art-chick-deep)" />
      {/* wings */}
      <ellipse cx="29" cy="62" rx="7" ry="12" transform="rotate(34 29 62)" fill="var(--np-art-wing)" />
      <ellipse cx="91" cy="62" rx="7" ry="12" transform="rotate(-34 91 62)" fill="var(--np-art-wing)" />
      {/* body and belly */}
      <ellipse cx="60" cy="60" rx="32" ry="34" fill="var(--np-art-chick)" />
      <ellipse cx="60" cy="78" rx="20" ry="14" fill="var(--np-art-chick-light)" />
      {/* face */}
      <Cheek x={40.5} y={60} />
      <Cheek x={79.5} y={60} />
      <path d="M54.5 57.5 Q60 54.8 65.5 57.5 Q61.2 64 60 64 Q58.8 64 54.5 57.5 Z" fill="var(--np-art-beak)" />
      {resting ? (
        <>
          <ClosedEye x={48.5} y={51} />
          <ClosedEye x={71.5} y={51} />
        </>
      ) : (
        <>
          <Eye x={49} y={50} />
          <Eye x={71} y={50} />
        </>
      )}
    </ArtFrame>
  );
}

/** An empty nest, waiting for the chick at the end of the path. */
export function Nest({ className }: { className?: string }) {
  return (
    <ArtFrame className={className}>
      <ellipse cx="60" cy="106" rx="44" ry="5" fill="var(--np-art-shadow)" />
      <ellipse cx="60" cy="76" rx="43" ry="10" fill="var(--np-art-nest-deep)" />
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
