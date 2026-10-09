import { ArtFrame, Cheek, ClosedEye, Shadow, Smile, type ArtProps } from "./parts";

/** A sleepy bunny, curled up with its eyes closed. */
export function Bunny({ className, animated = false }: ArtProps) {
  return (
    <ArtFrame className={className}>
      <Shadow cy={107} rx={40} />
      <g className={animated ? "np-loop-breathe" : undefined}>
        {/* ears, tipped back a little */}
        <ellipse cx="48" cy="30" rx="7.5" ry="18" transform="rotate(-15 48 30)" fill="var(--np-art-bunny-deep)" />
        <ellipse cx="72" cy="30" rx="7.5" ry="18" transform="rotate(15 72 30)" fill="var(--np-art-bunny-deep)" />
        <ellipse cx="48" cy="31" rx="3.4" ry="12" transform="rotate(-15 48 31)" fill="var(--np-art-cheek)" />
        <ellipse cx="72" cy="31" rx="3.4" ry="12" transform="rotate(15 72 31)" fill="var(--np-art-cheek)" />
        {/* tail, body, head */}
        <circle cx="96" cy="92" r="7" fill="var(--np-art-bunny)" />
        <ellipse cx="60" cy="88" rx="37" ry="19" fill="var(--np-art-bunny-deep)" />
        <circle cx="60" cy="64" r="24" fill="var(--np-art-bunny)" />
        {/* front paws */}
        <ellipse cx="48" cy="102" rx="8.5" ry="5" fill="var(--np-art-bunny)" />
        <ellipse cx="72" cy="102" rx="8.5" ry="5" fill="var(--np-art-bunny)" />
        {/* face */}
        <ClosedEye x={50.5} y={63} />
        <ClosedEye x={69.5} y={63} />
        <Cheek x={43.5} y={71} />
        <Cheek x={76.5} y={71} />
        <ellipse cx="60" cy="69.5" rx="2.6" ry="2" fill="var(--np-art-nose)" />
        <Smile x={60} y={73} width={5} />
      </g>
    </ArtFrame>
  );
}
