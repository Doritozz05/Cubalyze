"use client";

export function Cube3DPreview() {
  const cx = 24;
  const cy = 24;
  const u = [12.5, -7.2] as const;
  const v = [-12.5, -7.2] as const;
  const w = [0, 14.4] as const;
  const U_color = "#f8fafc";
  const F_color = "#16a34a";
  const R_color = "#dc2626";
  const pad = 0.08;

  const getCell = (
    origin: [number, number],
    dir1: readonly [number, number],
    dir2: readonly [number, number],
    r: number,
    c: number,
  ) => {
    const s1 = c / 3 + pad / 6;
    const e1 = (c + 1) / 3 - pad / 6;
    const s2 = r / 3 + pad / 6;
    const e2 = (r + 1) / 3 - pad / 6;
    const p0 = [origin[0] + s1 * dir1[0] + s2 * dir2[0], origin[1] + s1 * dir1[1] + s2 * dir2[1]];
    const p1 = [origin[0] + e1 * dir1[0] + s2 * dir2[0], origin[1] + e1 * dir1[1] + s2 * dir2[1]];
    const p2 = [origin[0] + e1 * dir1[0] + e2 * dir2[0], origin[1] + e1 * dir1[1] + e2 * dir2[1]];
    const p3 = [origin[0] + s1 * dir1[0] + e2 * dir2[0], origin[1] + s1 * dir1[1] + e2 * dir2[1]];
    return `${p0[0].toFixed(2)},${p0[1].toFixed(2)} ${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} ${p3[0].toFixed(2)},${p3[1].toFixed(2)}`;
  };

  const topPeak: [number, number] = [cx + u[0] + v[0], cy + u[1] + v[1]];
  const rightCorner: [number, number] = [cx + u[0], cy + u[1]];
  const bottomRight: [number, number] = [cx + u[0] + w[0], cy + u[1] + w[1]];
  const bottomPeak: [number, number] = [cx + w[0], cy + w[1]];
  const bottomLeft: [number, number] = [cx + v[0] + w[0], cy + v[1] + w[1]];
  const leftCorner: [number, number] = [cx + v[0], cy + v[1]];
  const outerFrame = [topPeak, rightCorner, bottomRight, bottomPeak, bottomLeft, leftCorner]
    .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");

  return (
    <div className="grid size-full place-items-center">
      <svg viewBox="0 0 48 44" className="size-full max-h-11">
        <ellipse cx={24} cy={41} rx={16} ry={3} fill="rgba(0,0,0,0.14)" />
        <polygon points={outerFrame} fill="#111111" stroke="#111111" strokeWidth={1} strokeLinejoin="round" />
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon key={`u-${r}-${c}`} points={getCell([cx, cy], v, u, r, c)} fill={U_color} />
          )),
        )}
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon key={`l-${r}-${c}`} points={getCell([cx, cy], v, w, r, c)} fill={F_color} />
          )),
        )}
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <polygon key={`r-${r}-${c}`} points={getCell([cx, cy], u, w, r, c)} fill={R_color} />
          )),
        )}
      </svg>
    </div>
  );
}
