/** Depura el cierre setup+alg del slot-model para un caso concreto (Ca). */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<string, { setup: string }>;

function invertSequence(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.endsWith("'")) out.push(t.slice(0, -1));
    else if (t.endsWith("2")) out.push(t);
    else out.push(t + "'");
  }
  return out.join(" ");
}
function dump(s: CubeState, label: string): void {
  const cp = Array.from(s.cp as any), co = Array.from(s.co as any), ep = Array.from(s.ep as any), eo = Array.from(s.eo as any);
  console.log(`${label} cp=[${cp}] co=[${co}] ep=[${ep}] eo=[${eo}]`);
}

const p = "Ca";
const top = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed)[0];
const A = top.moves;
const setup = TAX[p].setup;
console.log(`p=${p} top=${A} (speed ${top.speed}) | TAX.setup=${setup}`);
console.log(`invert(top)=${invertSequence(A)} | setup==invert(top): ${setup === invertSequence(A)}`);

const canon = new CubeState(); canon.applySequence(invertSequence(A));
console.log("\ncanon (A^-1 · solved):");
dump(canon, "canon");
const effFR = canon.clone(); effFR.applySequence(A);
console.log("effFR (canon + A):");
dump(effFR, "effFR");

// cierre FL
const setupFL = `y ${setup} y'`;
const algFL = `y ${A} y'`;
console.log(`\nFL: setup="${setupFL}" alg="${algFL}"`);
const chk = new CubeState();
console.log("solved:", (() => { let ok = true; for (let i = 0; i < 8; i++) if (chk.cp[i] !== i) ok = false; return ok; })());
chk.applySequence(setupFL);
dump(chk, "  tras setupFL");
chk.applySequence(algFL);
dump(chk, "  tras algFL");
chk.applySequence("y");
dump(chk, "  tras y (rInv)");

// comparar con effFR y con solved
function eq(a: CubeState, b: CubeState): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
const solved = new CubeState();
console.log(`chk == effFR: ${eq(chk, effFR)} | chk == solved: ${eq(chk, solved)}`);
