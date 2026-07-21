"use client";

export function Scramble2DPreview() {
  const S = 4;
  const G = 0.5;
  const FG = 2;
  const FACE = 3 * S + 2 * G;
  const PAD = 2;

  const colors = {
    U: "#ffffff",
    R: "#dc2626",
    F: "#16a34a",
    D: "#eab308",
    L: "#f97316",
    B: "#2563eb",
  };

  const faces: Record<string, [number, number]> = {
    U: [PAD + FACE + FG, PAD],
    L: [PAD, PAD + FACE + FG],
    F: [PAD + FACE + FG, PAD + FACE + FG],
    R: [PAD + 2 * FACE + 2 * FG, PAD + FACE + FG],
    B: [PAD + 3 * FACE + 3 * FG, PAD + FACE + FG],
    D: [PAD + FACE + FG, PAD + 2 * FACE + 2 * FG],
  };

  return (
    <svg viewBox="0 0 56 44" className="size-full">
      <rect width="56" height="44" fill="transparent" rx={2} />
      {Object.entries(faces).map(([face, [fx, fy]]) => {
        const c = colors[face as keyof typeof colors];
        return (
          <g key={face}>
            <rect
              x={fx - 0.5}
              y={fy - 0.5}
              width={FACE + 1}
              height={FACE + 1}
              fill="#111"
              rx={0.4}
            />
            {Array.from({ length: 9 }).map((_, i) => {
              const sr = Math.floor(i / 3);
              const sc = i % 3;
              return (
                <rect
                  key={i}
                  x={fx + sc * (S + G)}
                  y={fy + sr * (S + G)}
                  width={S}
                  height={S}
                  fill={c}
                  rx={0.3}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
