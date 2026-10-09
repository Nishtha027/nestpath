import { ArtFrame, Cheek, Eye, HappyEye, Shadow, Smile } from "./parts";

/** A bear cub. "happy" gives it smiling, crinkled eyes (for celebrations). */
export function BearCub({ className, happy = false }: { className?: string; happy?: boolean }) {
  return (
    <ArtFrame className={className}>
      <Shadow cy={109} rx={32} />
      {/* body, behind the head */}
      <ellipse cx="60" cy="95" rx="28" ry="15" fill="var(--np-art-bear)" />
      {/* ears */}
      <circle cx="37" cy="33" r="11" fill="var(--np-art-bear)" />
      <circle cx="83" cy="33" r="11" fill="var(--np-art-bear)" />
      <circle cx="37" cy="33" r="5.5" fill="var(--np-art-bear-light)" />
      <circle cx="83" cy="33" r="5.5" fill="var(--np-art-bear-light)" />
      {/* paws */}
      <ellipse cx="46" cy="104" rx="9" ry="5.5" fill="var(--np-art-bear-deep)" />
      <ellipse cx="74" cy="104" rx="9" ry="5.5" fill="var(--np-art-bear-deep)" />
      {/* head and muzzle */}
      <circle cx="60" cy="58" r="30" fill="var(--np-art-bear)" />
      <ellipse cx="60" cy="70" rx="14" ry="10.5" fill="var(--np-art-bear-light)" />
      {/* face */}
      {happy ? (
        <>
          <HappyEye x={47.5} y={53} />
          <HappyEye x={72.5} y={53} />
        </>
      ) : (
        <>
          <Eye x={47.5} y={53} />
          <Eye x={72.5} y={53} />
        </>
      )}
      <Cheek x={39} y={64} />
      <Cheek x={81} y={64} />
      <ellipse cx="60" cy="65.5" rx="4.6" ry="3.4" fill="var(--np-art-face)" />
      <Smile x={60} y={71} width={8} />
    </ArtFrame>
  );
}
