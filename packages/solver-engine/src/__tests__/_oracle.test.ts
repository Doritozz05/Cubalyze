import { it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import min2phase from "min2phase.js";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";

const OLL = resolve(__dirname, "../../../../pruebas/generated/scdb-oll.json");

function oracleSolved(state: CubeState): boolean {
  const f = FaceletStringConverter.toFaceletString(state);
  const sol = min2phase.solve(f);
  return sol === "" || sol === "0";
}

// Oracle data is generated locally (pruebas/scripts/...) and pruebas/ is
// gitignored — skip in CI / fresh checkouts where the JSON is absent.
it.runIf(existsSync(OLL))("oracle: failing classic OLL algs really solve?", () => {
  min2phase.initFull();
  console.log("Q0 solved =>", oracleSolved(new CubeState()));

  const oll = JSON.parse(readFileSync(OLL, "utf-8"));
  const cases = oll.cases as { caseDef: { caseNumber: string; setupScramble: string }; algorithms: { moves: string[]; isDefault: boolean }[] }[];

  const targets: [string, string][] = [
    ["OLL 8", "R U2 R' U2 R' F R F'"],
    ["OLL 13", "F U R U2 R' U' R U R' F'"],
    ["OLL 7", "L' U2 L U2 L F' L' F"],
  ];
  for (const [caseNum, alg] of targets) {
    const c = cases.find((x) => x.caseDef.caseNumber === caseNum)!;

    const t = new CubeState();
    t.applySequence(c.caseDef.setupScramble);
    t.applySequence(alg);
    console.log(`Q ${caseNum} setup+[${alg}] => model:${t.isSolved()} oracle:${oracleSolved(t)}`);

    const dflt = c.algorithms.find((a) => a.isDefault)!;
    const t2 = new CubeState();
    t2.applySequence(c.caseDef.setupScramble);
    t2.applySequence(dflt.moves.join(" "));
    console.log(`Q ${caseNum} setup+default => model:${t2.isSolved()} oracle:${oracleSolved(t2)}`);

    const t3 = new CubeState();
    t3.applySequence(alg);
    const f3 = FaceletStringConverter.toFaceletString(t3);
    console.log(`Q ${caseNum} [${alg}](solved) => oracle solve: "${min2phase.solve(f3)}"`);
  }
});
