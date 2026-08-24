import { analyzeSolveText } from "../../packages/analysis-engine/src/index";

const cases = [
  {
    key: "reconz-1508",
    setup: "B' L2 F D2 U2 F2 U2 B' U2 R2 F U' L2 D B' R D F' L' R D",
    text: "y' x // inspection\nU x' U' r' R U' x' D L' D2' // cross\ny L' U L U' L' U' L // 1st pair\nL U2' L' U L U' L' // 2nd pair\nU' R U2' R2' U' R // 3rd pair\nU2' R U R' U2' R U R' U' R U R' // 4th pair\nU2' l U' l2' U l2 U l2' U' l // OLL\nU2' R2 u' R U' R U R' u R2 y R U' R' U' // PLL",
  },
  {
    key: "cuberoot-1296",
    setup: "F2 L B R D R' F2 U' D2 L2 F2 B D2 L2 B' L2 F U2 F",
    text: "x' z' // insp\nU' r' D' F2 R D2 // W cross\nR (U' R' R U') R2' U R // GO\n(U R' R U') R U' R' d' L U' L' // RB\n(U' U') d R U' R' U d R' U' R // GR\ny' (U' U') R' F' R U R U' R' F // BO\nr U' r2' U r2 U r2' U' r // OLL-R+\n(U' U') R' U L' U2 R U' R' U2 R L U' // PLL-L",
  },
  {
    key: "reconz-818 (Roux)",
    setup: "B U2 R2 B F' R' U2 F2 U2 F2 D R F2 L' R' B2 D' R'",
    text: "x2 z // inspection\nr U' r2' F' R2' R2 U R' r' U // FB\nx' r U' r' R U' R' // SS\nU M' U' r' // SP\nU2' R' U' R U' R' U F' U F R // CMLL\nU' M' U M' U M U' M' U M2' U' // EOLR\nU2 M2' U2 // EP",
  },
];

for (const c of cases) {
  try {
    const { timeline, reconstruction } = analyzeSolveText({
      setup: c.setup, inspection: undefined, solution: c.text, method: "CFOP",
    });
    const faceTotal =
      reconstruction.cross.moves.length +
      reconstruction.pairs.reduce((s, p) => s + p.moves.length, 0) +
      (reconstruction.oll?.moves.length ?? 0) +
      (reconstruction.pll?.moves.length ?? 0);
    console.log(c.key, "OK — finalSolved:", reconstruction.finalSolved,
      "entries:", timeline.entries.length, "faceTotal:", faceTotal,
      "cross:", reconstruction.cross.moves.length,
      "pairs:", reconstruction.pairs.length,
      "rotations:", reconstruction.rotations.map((r) => r.token).join(" "));
  } catch (e) {
    console.log(c.key, "STILL THROWS:", e instanceof Error ? e.message : e);
  }
}
