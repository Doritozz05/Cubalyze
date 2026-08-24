import { CubeState } from "../../packages/math-core/src/index";

const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number; kind: string } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c], kind: "trapped-corner" };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e, kind: "trapped-edge" };
  return { homeC: 4, homeE: 8, kind: "basic" };
}

const findPos = (arr: number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};

function dump(label: string, setup: string) {
  const s = new CubeState();
  try { s.applySequence(setup); } catch (e) { console.log(label, "ERR", e); return; }
  const pair = identifyPair(s);
  const out: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) out.push(`C${c}→pos${findPos(s.cp, c)}`);
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) out.push(`E${e}→pos${findPos(s.ep, e)}`);
  console.log(`\n${label}: setup="${setup}"`);
  console.log(`  pareja: {${pair.homeC},${pair.homeE}} (${pair.kind})`);
  console.log(`  cp[4]=${s.cp[4]} ep[8]=${s.ep[8]}`);
  console.log(`  fuera: ${out.join(" ")}`);
}

dump("Nuestro actual", "R F U R2 F' R'");
dump("Setup limpio local", "F' U2 L F L2 U' L U");
dump("Quest (paste)", "U' F' R' F R U F L2 U2 F' U2 F U2 B' U2 B L2");
