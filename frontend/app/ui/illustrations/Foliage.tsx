// Small pieces of foliage for decorating around the app's artwork: flowers,
// leaves and sprigs in flat pastel shapes, colors from the --np-art-* tokens.

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
export function Sprig({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
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
  );
}
