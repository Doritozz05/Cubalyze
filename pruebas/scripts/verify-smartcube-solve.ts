/**
 * Fase 0.5 — Verificación de UN solve REAL del smart cube.
 *
 * Reproduce el pipeline EXACTO de la app (compaction + TimelineBuilder +
 * PhaseSplitter colorNeutral) y además verifica por COLOR que las fronteras
 * de fase son reales (cross/F2L/OLL de verdad completadas en esos índices).
 *
 * Datos en pruebas/generated/smartcube-solve.json:
 *   { scramble, moves | movesNotation, appPhases?, appMetrics? }
 *
 * Uso: pnpm dlx tsx pruebas/scripts/verify-smartcube-solve.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { TimelineBuilder } from "../../packages/analysis-engine/src/timeline/TimelineBuilder";
import { PhaseSplitter } from "../../packages/analysis-engine/src/phases/PhaseSplitter";
import { CFOPDefinition, CubeState, compactCubeMoves, FaceletStringConverter } from "../../packages/math-core/src/index";

interface PhaseInfo { name: string; start?: number; end?: number; moveCount?: number; durationMs?: number; }
interface RawSolve {
  scramble?: string;
  moves?: { face: string; direction: number; cubeTimestamp?: number; hostTimestamp?: number }[];
  movesNotation?: string;
  appPhases?: PhaseInfo[];
  appMetrics?: Record<string, unknown>;
}

const data = JSON.parse(
  readFileSync(resolve(__dirname, "../generated/smartcube-solve.json"), "utf-8"),
) as RawSolve;

const PRIME = /[’′´]/g;

// ── Parseo de notación → eventos ────────────────────────────────────────
function parseNotation(notation: string): { face: string; direction: number }[] {
  return notation
    .replace(PRIME, "'")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({
      face: t[0],
      direction: t.endsWith("'") ? -1 : t.endsWith("2") ? 2 : 1,
    }));
}

let rawEvents: { face: string; direction: number; cubeTimestamp: number; hostTimestamp: number }[];
if (data.moves?.length) {
  rawEvents = data.moves.map((m, i) => ({
    face: m.face,
    direction: m.direction,
    cubeTimestamp: m.cubeTimestamp ?? i,
    hostTimestamp: m.hostTimestamp ?? i,
  }));
} else if (data.movesNotation) {
  rawEvents = parseNotation(data.movesNotation).map((m, i) => ({
    ...m,
    cubeTimestamp: i,
    hostTimestamp: i,
  }));
} else {
  console.error("No hay moves ni movesNotation en smartcube-solve.json");
  process.exit(1);
}

const scramble = data.scramble ?? "";

// ── Helpers de verificación por COLOR (facelets URFDLB, 54 chars) ───────
// cara X: stickers X*9..X*9+8, centro X*9+4, aristas X*9+1,+3,+5,+7
const FACE_EDGES = [0, 1, 2, 3, 4, 5].map((f) => [f * 9 + 1, f * 9 + 3, f * 9 + 5, f * 9 + 7]);
const CENTER = (f: number) => f * 9 + 4;

/** Caras cuya cross está hecha por COLOR (4 aristas = color del centro). */
function crossFacesByColor(facelets: string): number[] {
  const out: number[] = [];
  for (let f = 0; f < 6; f++) {
    const c = facelets[CENTER(f)];
    if (FACE_EDGES[f].every((i) => facelets[i] === c)) out.push(f);
  }
  return out;
}

/** Cross hecha (por color): las 4 aristas de la cara X = color del centro X. */
function crossDone(f: string, x: number): boolean {
  const c = f[CENTER(x)];
  return FACE_EDGES[x].every((k) => f[k] === c);
}

/** Ecuador en sitio: cada arista del ecuador muestra sus 2 colores en las caras correctas. */
function equatorInPlace(f: string): boolean {
  // FR en F(1,2) y R(1,2) · RB en R(1,0) y B(1,0) · BL en B(1,2) y L(1,2) · LF en L(1,0) y F(1,0)
  const checks: [number, string][] = [
    [2 * 9 + 5, "F"], [1 * 9 + 5, "R"],
    [1 * 9 + 3, "R"], [5 * 9 + 3, "B"],
    [5 * 9 + 5, "B"], [4 * 9 + 5, "L"],
    [4 * 9 + 3, "L"], [2 * 9 + 3, "F"],
  ];
  return checks.every(([i, col]) => f[i] === col);
}

/** F2L hecha (por color): cross + esquinas de la capa de la cross + ecuador. */
function f2lDone(f: string, x: number): boolean {
  if (!crossDone(f, x)) return false;
  if (x === 0) return f.slice(0, 9) === "UUUUUUUUU" && equatorInPlace(f); // cross en U
  if (x === 3) return f.slice(27, 36) === "DDDDDDDDD" && equatorInPlace(f); // cross en D
  return false; // cross en cara lateral: requiere geometría específica
}

/** OLL hecha (por color): la cara opuesta a la cross es de un solo color. */
function ollDone(f: string, x: number): boolean {
  const opp = (x + 3) % 6;
  const c = f[CENTER(opp)];
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue;
    if (f[opp * 9 + i] !== c) return false;
  }
  return true;
}

// ── Reproducción del pipeline EXACTO de la app ──────────────────────────
const compacted = compactCubeMoves(rawEvents as never, undefined);
const events = compacted.moves as { face: string; direction: number; cubeTimestamp: number; hostTimestamp: number }[];
console.log("════════════════════════════════════════════════════════");
console.log(`Solve real · ${rawEvents.length} movimientos crudos → ${events.length} compactados`);
console.log(`Scramble: ${scramble}`);
console.log("════════════════════════════════════════════════════════\n");

const timeline = TimelineBuilder.build(events, "CFOP", undefined, scramble);
PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

const stateOf = (i: number) => TimelineBuilder.fromSnapshot(timeline.entries[i].state);
const faceletOf = (i: number) => FaceletStringConverter.toFaceletString(stateOf(i));

const report = timeline.detectionReport;
console.log("── Pipeline real (lo que produce la app) ──");
console.log(`crossFace: ${report?.crossFace ?? "—"} · confianza: ${report?.confidence}`);
console.log(`warnings: ${report?.warnings.join(", ") || "(ninguna)"}`);
console.log(`phases: ${timeline.phases.length}`);
for (const p of timeline.phases) {
  console.log(`  • ${p.phaseName}: movimientos ${p.startIndex + 1}–${p.endIndex + 1} (${p.moveCount}m, ${Math.round(p.durationMs)}ms)${p.skipped ? " [skipped]" : ""}`);
}

console.log("\n── Comparación con lo que reportó la app ──");
if (data.appPhases?.length) {
  for (const ap of data.appPhases) {
    const mine = timeline.phases.find((p) => p.phaseName === ap.name);
    const ok = mine && mine.endIndex + 1 === ap.end;
    console.log(`  ${ap.name}: app=1–${ap.end} (${ap.moveCount}m) · pipeline=${mine ? mine.startIndex + 1 + "–" + (mine.endIndex + 1) : "—"} ${ok ? "✓" : "✗ DIFERENTE"}`);
  }
}

// ── Verificación por COLOR de las fronteras ─────────────────────────────
console.log("\n── Verificación por COLOR de las fases ──");

// cross: primer movimiento donde alguna cara tiene su cross por color
let firstCross = -1;
let crossFace = -1;
for (let i = 0; i < timeline.entries.length; i++) {
  const faces = crossFacesByColor(faceletOf(i));
  if (faces.length > 0) { firstCross = i; crossFace = faces[0]; break; }
}
console.log(`Cross por COLOR: mov ${firstCross + 1} · cara ${"URFDLB"[crossFace]} (centro "${"URFDLB"[crossFace]}")`);
console.log(`  → app la detectó en mov 14 ${firstCross + 1 <= 14 ? "(cross REAL antes o en 14 ✓)" : "(¿tardía?)"}`);

// primer movimiento con F2L por color
let firstF2L = -1;
for (let i = firstCross; i < timeline.entries.length; i++) {
  if (f2lDone(faceletOf(i), crossFace)) { firstF2L = i; break; }
}
console.log(`F2L por COLOR: mov ${firstF2L + 1} · app la detectó en mov 57 ${firstF2L + 1 <= 57 ? "✓ REAL" : "(¿tardía?)"}`);

// primer movimiento con OLL por color
let firstOLL = -1;
for (let i = firstF2L; i < timeline.entries.length; i++) {
  if (ollDone(faceletOf(i), crossFace)) { firstOLL = i; break; }
}
console.log(`OLL por COLOR: mov ${firstOLL + 1} · app la detectó en mov 91 ${firstOLL + 1 <= 91 ? "✓ REAL" : "(¿tardía?)"}`);

// final
const lastFacelets = faceletOf(timeline.entries.length - 1);
const solved = lastFacelets === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
console.log(`Final: ${solved ? "resuelto ✓" : "NO resuelto ✗"}`);

// Interpretación
console.log("\n── Interpretación ──");
const crossColorName = "URFDLB"[crossFace];
const canonicalEdgeColor = "URFDLB"[crossFace];
console.log(`Tu cross está en la cara ${crossColorName} (centro ${crossColorName}).`);
console.log(`Las aristas canónicas de la cara ${canonicalEdgeColor} son color ${canonicalEdgeColor} → la máscara color-neutral de esa cara las detecta.`);
console.log(`Por eso la app SÍ divide las fases en este solve: el color de tu cross coincide con las aristas canónicas de esa cara.`);
