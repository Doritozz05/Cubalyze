/** Debug: detalle posicional de los estados S (derivados) vs T (quest) para el cluster Hn/Ht/Sf/Sl. */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function pieceAt(s: CubeState, want: number, kind: "c" | "e"): { pos: number; orient: number } | null {
  const arr = kind === "c" ? s.cp : s.ep;
  const oArr = kind === "c" ? s.co : s.eo;
  for (let i = 0; i < arr.length; i++) if (arr[i] === want) return { pos: i, orient: oArr[i] };
  return null;
}
function outSet(s: CubeState): string {
  const findPos = (arr: readonly number[], p: number) => { for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i; return -1; };
  const o: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) o.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) o.push(`E${e}`);
  return o.sort().join("");
}
const CNAMES = ["ULB", "UBR", "UFR", "ULF", "DFR", "DLF", "DBL", "DBR", "URF", "UFL", "UBL", "URB"];
const ENAMES = ["UB", "UR", "UF", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BL", "BR"];

const NEEDED = ["Hn", "Ht", "Sf", "Sl"];
const derived = DERIVED.filter((r: any) => r.status === "derived" && r.setup && !r.basic);
const states = derived.map((m: any) => ({ patid: m.patid, setup: m.setup, state: stateOf(m.setup), out: outSet(stateOf(m.setup)) }));

for (const patid of NEEDED) {
  const T = stateOf(normQuest(QA[patid.toLowerCase()].setup));
  const tOut = outSet(T);
  console.log(`\n=== ${patid}  (fuera: ${tOut}) ===`);
  console.log(`T(quest) setup: ${normQuest(QA[patid.toLowerCase()].setup)}`);
  const cands = states.filter((s: any) => s.out === tOut);
  for (const c of cands.slice(0, 4)) {
    console.log(`\n-- candidato ${c.patid}: setup ${c.setup}`);
    console.log(`   setup len ${c.setup.split(" ").length}`);
    for (const p of [4, 6]) {
      const sP = pieceAt(c.state, p, "c");
      const tP = pieceAt(T, p, "c");
      console.log(`   C${p}: S->pos${sP?.pos}(${CNAMES[sP?.pos ?? -1]})o${sP?.orient} | T->pos${tP?.pos}(${CNAMES[tP?.pos ?? -1]})o${tP?.orient}${sP?.pos === tP?.pos && sP?.orient === tP?.orient ? "  ===" : "  DIFF"}`);
    }
    for (const p of [8, 11]) {
      const sP = pieceAt(c.state, p, "e");
      const tP = pieceAt(T, p, "e");
      console.log(`   E${p}: S->pos${sP?.pos}(${ENAMES[sP?.pos ?? -1]})o${sP?.orient} | T->pos${tP?.pos}(${ENAMES[tP?.pos ?? -1]})o${tP?.orient}${sP?.pos === tP?.pos && sP?.orient === tP?.orient ? "  ===" : "  DIFF"}`);
    }
    // también: qué pieza está en cada posición U-layer y slot
  }
}
