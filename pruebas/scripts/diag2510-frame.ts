/**
 * Diagnóstico del frame del solve 2510 (Liam Walton, CubeRoot).
 *
 * Pregunta: ¿bajo qué interpretación de las rotaciones la reconstrucción es
 * coherente, y en qué frame está escrita?
 *
 *  - Replay LITERAL (rotaciones como movimientos): si el final es rotación de
 *    solved, la solución es fiel y la rotación residual R nos da el frame del
 *    solver (su "D" = R⁻¹(D) canónica, etc.).
 */
import { CubeState } from "../../packages/math-core/src/index";

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

// Versión del usuario (pegada de speedcube.quest) — la autoritativa
const SOLVE_USER = [
  "D2 L U R' U'",                          // Cross (5)
  "D' L' U L U' L' U L D",                 // F2L 1 BL Pj (9)
  "U2 y' L' U L U' L' U L U2 L' U L",      // F2L 2 FR Jm (12, 1 rot)
  "U' L U' L'",                            // F2L 3 FL Jb (4)
  "y' R' U2 R U R' U' R",                  // F2L 4 BR Ci (7, 1 rot)
  "R' U' R' F R F' U R",                   // OLL 46 (8)
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'", // PLL Gd (16)
];

// Versión del script viejo (incluye inspección z y y x' en F2L1, U2 U en F2L3)
const SOLVE_OLD = [
  "z y",
  "D2 L U R' U'",
  "x' D' L' U L U' L' U L D",
  "U2 y' L' U L U' L' U L U2 L' U L",
  "U2 U L U' L'",
  "y' R' U2 R U R' U' R",
  "R' U' R' F R F' U R",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
];

const fullSig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}|${Array.from(c.co).join(",")}|${Array.from(c.eo).join(",")}`;

function genRotations(): string[] {
  const seen = new Set<string>([fullSig(new CubeState())]);
  const queue: { seq: string; key: string }[] = [{ seq: "", key: fullSig(new CubeState()) }];
  const out: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur.seq);
    for (const m of ["x", "y", "z"]) {
      const seq = (cur.seq + " " + m).trim();
      const c = new CubeState();
      c.applySequence(seq);
      const k = fullSig(c);
      if (!seen.has(k)) { seen.add(k); queue.push({ seq, key: k }); }
    }
  }
  return out;
}
const ROTS = genRotations();

function findRotOfSolved(c: CubeState): string | null {
  const key = fullSig(c);
  for (const r of ROTS) {
    const t = new CubeState();
    if (r) t.applySequence(r);
    if (fullSig(t) === key) return r;
  }
  return null;
}

function run(label: string, phases: string[], withInspection: boolean) {
  const state = new CubeState();
  state.applySequence(SCRAMBLE);
  let nRot = 0, nFace = 0;
  const phaseBorders: { name: string; start: number; end: number; toks: number }[] = [];
  let idx = 0;
  for (const ph of phases) {
    const toks = tokenize(ph);
    const faceToks = toks.filter((t) => !/^[xyz]/.test(t));
    nRot += toks.length - faceToks.length;
    nFace += faceToks.length;
    phaseBorders.push({ name: ph.slice(0, 6), start: idx, end: idx + toks.length - 1, toks: toks.length });
    idx += toks.length;
    for (const t of toks) state.applySequence(t);
  }
  const final = state.clone();
  const exact = final.isSolved();
  const rot = findRotOfSolved(final);
  console.log(`\n═══ ${label} ═══`);
  console.log(`moves: ${nFace} STM + ${nRot} rotaciones = ${idx} tokens`);
  console.log(`final isSolved: ${exact} | rotación-de-resuelto: ${rot ?? "NONE"}`);
  if (!exact && rot) {
    // El frame del solver: su D es R⁻¹(D_canónico)
    const R = new CubeState();
    R.applySequence(rot);
    // ¿qué cara canónica ocupa ahora la posición D? Aplica rot y mira qué cara está en D
    const facelets = [
      ["U", 4], ["R", 13], ["F", 22], ["D", 31], ["L", 40], ["B", 49],
    ];
    // R aplicado a un cubo con centros marcados con su letra… los centros del modelo
    // no existen; usamos el estado solved con las caras coloreadas por posición.
    // Método: el solver resuelve a R·solved; su cross está en su cara D = cara que
    // R mapea a D. Comprobamos sobre el state final cuál cara canónica está en D.
    const c = final.clone();
    // Marcamos centros con FaceletStringConverter? Mejor: aplicamos rot a solved y
    // vemos qué cara canónica queda abajo (posición 27-35 = D).
    const Rsolved = new CubeState();
    Rsolved.applySequence(rot);
    // Los centros no existen; inferimos por las esquinas: la esquina DFR (pieza 4)
    // está en posición 4 tras Rsolved → si cp[4]===4, la cara D de R·solved es D.
    // En general: posición p recibe la pieza que en solved tenía la cara f.
    // Imprimimos el facelet string del final para inspección manual.
    const { FaceletStringConverter } = require("../../packages/math-core/src/index");
    console.log(`facelets final: ${FaceletStringConverter.toFaceletString(final)}`);
  }
}

run("USER (pegada, sin inspección, sin x')", SOLVE_USER, false);
run("OLD (script previo: z y inspección + x' + U2 U)", SOLVE_OLD, true);
