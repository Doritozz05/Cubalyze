/**
 * min2phase oracle for CMLL: after setup+alg, is the state "solved except the
 * M-slice" (a valid Roux LSE state)? min2phase solves any state; if the state
 * is CMLL-valid, the optimal solution will use few moves and only M-slice
 * pieces (checked piece by piece, not via the solution).
 */
import { it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { CubeState, FaceletStringConverter } from "@cubalyze/math-core";

// generateFromScramble only applies the setup to a solved cube:
function setupState(setup: string): CubeState {
  const s = new CubeState();
  for (const tok of setup.split(/\s+/).filter(Boolean)) s.applySequence(tok);
  return s;
}

const CMLL = resolve(__dirname, "../../../../pruebas/generated/scdb-cmll.json");

// Oracle data is generated locally (pruebas/scripts/...) and pruebas/ is
// gitignored — skip in CI / fresh checkouts where the JSON is absent.
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

it.runIf(existsSync(CMLL))("oracle: are the 39 failures valid LSE states?", () => {
  const gen = JSON.parse(readFileSync(CMLL, "utf-8"));
  let total = 0, lseOkCount = 0;
  const fails: string[] = [];
  for (const c of gen.cases) {
    const s = setupState(c.caseDef.setupScramble);
    for (const a of c.algorithms) {
      const t = s.clone();
      t.applySequence(a.moves.join(" "));
      const fl = flOf(t);
      // Valid LSE: 8 corners home + E edges (8-11) and D edges (4-7) home.
      // Only U-edges (0-3) and centers are free.
      const cs = [0, 1, 2, 3, 4, 5, 6, 7].map((p) => cubieHome("c", p, fl));
      const es = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => cubieHome("e", p, fl));
      const cornersOk = cs.every((h, i) => h === i);
      const fixedEdgesOk = [4, 5, 6, 7, 8, 9, 10, 11].every((p) => es[p] === p);
      const uEdgesFree = es.slice(0, 4); // their location does not matter
      total++;
      if (cornersOk && fixedEdgesOk) { lseOkCount++; }
      else if (!a.isDefault) fails.push(`${c.caseDef.caseNumber} | ${a.moves.join(" ").slice(0, 45)}`);
    }
  }
  console.log(`TOTAL: ${total} | valid LSE states: ${lseOkCount} (${(100 * lseOkCount / total).toFixed(1)}%)`);
  console.log(`Non-LSE non-default (${fails.length}):`);
  for (const f of fails.slice(0, 12)) console.log("  " + f);
});
