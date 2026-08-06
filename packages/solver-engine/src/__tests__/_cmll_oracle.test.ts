/**
 * Oráculo min2phase para CMLL: tras setup+alg, ¿el estado es "resuelto excepto
 * M-slice" (estado Roux LSE válido)? min2phase resuelve cualquier estado; si
 * el estado es CMLL-válido, la solución óptima usará pocos movimientos y solo
 * piezas del M-slice (se comprueba pieza a pieza, no por la solución).
 */
import { it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";

// generateFromScramble solo aplica el setup a un cubo resuelto:
function setupState(setup: string): CubeState {
  const s = new CubeState();
  for (const tok of setup.split(/\s+/).filter(Boolean)) s.applySequence(tok);
  return s;
}

const CMLL = resolve(__dirname, "../../../../pruebas/generated/scdb-cmll.json");
const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s);

const cornerFacelet = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const edgeFacelet = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
const CCOL = [["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"], ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]];
const ECOL = [["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"], ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"]];
const SOLVED_FL = flOf(new CubeState());

function cubieHome(kind: "c" | "e", pos: number, fl: string): number {
  const idxs = kind === "c" ? cornerFacelet[pos] : edgeFacelet[pos];
  const cols = idxs.map((i) => fl[i]).slice().sort().join("");
  const table = kind === "c" ? CCOL : ECOL;
  return table.findIndex((c) => c.slice().sort().join("") === cols);
}

it("oráculo: ¿los 39 fallos son estados LSE válidos?", () => {
  const gen = JSON.parse(readFileSync(CMLL, "utf-8"));
  let total = 0, lseOkCount = 0;
  const fails: string[] = [];
  for (const c of gen.cases) {
    const s = setupState(c.caseDef.setupScramble);
    for (const a of c.algorithms) {
      const t = s.clone();
      t.applySequence(a.moves.join(" "));
      const fl = flOf(t);
      // LSE válido: 8 esquinas en casa + aristas E (8-11) y D (4-7) en casa.
      // Solo U-edges (0-3) y centros libres.
      const cs = [0, 1, 2, 3, 4, 5, 6, 7].map((p) => cubieHome("c", p, fl));
      const es = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => cubieHome("e", p, fl));
      const cornersOk = cs.every((h, i) => h === i);
      const fixedEdgesOk = [4, 5, 6, 7, 8, 9, 10, 11].every((p) => es[p] === p);
      const uEdgesFree = es.slice(0, 4); // no importa dónde estén
      total++;
      if (cornersOk && fixedEdgesOk) { lseOkCount++; }
      else if (!a.isDefault) fails.push(`${c.caseDef.caseNumber} | ${a.moves.join(" ").slice(0, 45)}`);
    }
  }
  console.log(`TOTAL: ${total} | estados LSE válidos: ${lseOkCount} (${(100 * lseOkCount / total).toFixed(1)}%)`);
  console.log(`No-LSE no-default (${fails.length}):`);
  for (const f of fails.slice(0, 12)) console.log("  " + f);
});
