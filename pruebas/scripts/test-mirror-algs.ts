/**
 * Verificacion definitiva del espejo con los ALGS TOP de BirdF2L:
 * espejo textual correcto (F<->R, L<->B, U<->U', D<->D', U2->U2, y->y'...).
 * El espejo del alg de p DEBE resolver el espejo del setup de p.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;

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

// espejo x=y (diagonal que fija el slot FR): la reflexion INVIERTE el sentido del giro
// R<->F', F<->R', L<->B', B<->L', U<->U', D<->D', M<->S', E<->E, y<->y'
// Verificado: espejo de "U R U' R'" = "U' F' U F" = alg top de Mi.
function mirrorMove(t: string): string {
  const m = t.match(/^([UDFBLRMESxyz])(2|')?$/);
  if (!m) return t;
  const face = m[1], suf = m[2] ?? "";
  if (suf === "2") {
    // el espejo de una cara + 2 = cara espejo + 2 (direccion no importa con 2)
    const f2: Record<string, string> = { R: "F", F: "R", L: "B", B: "L", U: "U", D: "D", M: "S", S: "M", E: "E", x: "x", y: "y", z: "z" };
    return (f2[face] ?? face) + "2";
  }
  const map: Record<string, string> = {
    R: "F'", "R'": "F", F: "R'", "F'": "R",
    L: "B'", "L'": "B", B: "L'", "B'": "L",
    U: "U'", "U'": "U", D: "D'", "D'": "D",
    M: "S'", "M'": "S", S: "M'", "S'": "M", E: "E",
    y: "y'", "y'": "y", x: "x'", "x'": "x", z: "z'", "z'": "z",
  };
  return map[face + suf] ?? map[face] + suf;
}
function mirrorAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).map(mirrorMove).join(" ");
}

// estados canonicos de BirdF2L (inverso del alg top)
const canon = new Map<string, CubeState>();
const topAlg = new Map<string, string>();
for (const patid of Object.keys(PARSED)) {
  const top = [...PARSED[patid].algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const s = new CubeState();
  try { s.applySequence(invertSequence(top.moves)); } catch { continue; }
  canon.set(patid, s);
  topAlg.set(patid, top.moves);
}

function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

// espejo REAL: probar hasta 5 algs por patron, espejar, y buscar que setup resuelve
console.log("=== espejo real por alg (mirror(alg p) -> setup q, top-5) ===");
const mirrorPairs = new Map<string, string>();
const patids = Object.keys(PARSED).sort();
const top5 = new Map<string, string[]>();
for (const p of patids) {
  top5.set(p, [...PARSED[p].algs].sort((a, b) => a.speed - b.speed).slice(0, 5).map((a) => a.moves));
}
let mOk = 0, mMulti = 0, mNone = 0;
const mNoneList: string[] = [];
const mMultiList: string[] = [];
for (const p of patids) {
  let solved: string[] = [];
  for (const alg of top5.get(p)!) {
    const malg = mirrorAlg(alg);
    solved = [];
    for (const q of patids) {
      for (let u = 0; u < 4; u++) {
        const t = canon.get(q)!.clone();
        try { t.applySequence(malg); } catch { continue; }
        if (f2lSolved(t)) { solved.push(q); break; }
      }
    }
    if (solved.length === 1) break;
  }
  if (solved.length === 1) { mirrorPairs.set(p, solved[0]); mOk++; }
  else if (solved.length > 1) { mMulti++; mMultiList.push(`${p}:${solved.join(",")}`); }
  else { mNone++; mNoneList.push(p); }
}
console.log(`1:1: ${mOk} | multi: ${mMulti} ${mMultiList.slice(0, 5).join(" ")} | none: ${mNone} -> ${mNoneList.join(" ")}`);
// espejos de los casos conflictivos
for (const p of ["Cp", "Cj", "Vp", "Kj", "Pj", "Kp", "Pp", "Vj", "Ch", "Cr", "Vh", "Vr", "Gh", "Hi", "Sb", "Th", "Xb", "Xh", "Xi", "Xj", "Xp", "Xr"]) {
  console.log(`  mirror(${p}) = ${mirrorPairs.get(p) ?? "?"}   (alg: ${top5.get(p)![0]})`);
}
let asym = 0;
for (const [a, b] of mirrorPairs) if (mirrorPairs.get(b) !== a) asym++;
console.log(`asimetricos: ${asym}`);
const autos = [...mirrorPairs].filter(([a, b]) => a === b).map(([a]) => a);
console.log(`auto-espejos: ${autos.length} -> ${autos.join(" ")}`);

// verificar los pares basicos: mirror(A_p) debe resolver el setup de q
console.log("\n=== pares basicos (mirror(alg p) resuelve setup q) ===");
const F2L_TO_PATID: Record<string, string> = {
  "1": "Jb", "2": "Mi", "3": "Je", "4": "Ma", "5": "Ja", "6": "Me", "7": "Jd", "8": "Mq",
  "9": "Jq", "10": "Md", "11": "Jm", "12": "Mc", "13": "Ji", "14": "Mb", "15": "Jc", "16": "Mm",
  "17": "Cb", "18": "Ci", "19": "Ca", "20": "Ce", "21": "Cd", "22": "Cq", "23": "Cc", "24": "Cm",
  "25": "Vb", "26": "Vi", "27": "Kb", "28": "Pi", "29": "Ki", "30": "Pb", "31": "Cp", "32": "Cj",
  "33": "Jj", "34": "Mj", "35": "Jp", "36": "Mp", "37": "Vp", "38": "Kj", "39": "Pj", "40": "Kp", "41": "Pp",
};
let bOk = 0;
for (let n = 1; n <= 41; n += 2) {
  const a = F2L_TO_PATID[String(n)];
  const b = n === 41 ? a : F2L_TO_PATID[String(n + 1)];
  // mirror(alg de a) aplicado al setup de b (probando las 4 rotaciones U = AUF libre)
  const malg = mirrorAlg(topAlg.get(a)!);
  let okb = false;
  for (let u = 0; u < 4 && !okb; u++) {
    const t = canon.get(b)!.clone();
    try { t.applySequence(malg); okb = f2lSolved(t); } catch { /* no */ }
    if (!okb) t.applySequence("U");
  }
  // y al reves: mirror(alg de b) aplicado al setup de a
  const malg2 = mirrorAlg(topAlg.get(b)!);
  let okb2 = false;
  for (let u = 0; u < 4 && !okb2; u++) {
    const t2 = canon.get(a)!.clone();
    try { t2.applySequence(malg2); okb2 = f2lSolved(t2); } catch { /* no */ }
    if (!okb2) t2.applySequence("U");
  }
  const okBoth = okb && okb2;
  if (okBoth) { bOk++; mirrorPairs.set(a, b); mirrorPairs.set(b, a); }
  const label = okBoth ? "OK" : `(${okb ? "ida" : "-"}/${okb2 ? "vuelta" : "-"})`;
  console.log(`  F2L ${n}/${n + 1} (${a}<->${b}): ${label}   ${topAlg.get(a)} | ${topAlg.get(b)}`);
}
console.log(`\nbasic verificado: ${bOk}/21 pares`);
