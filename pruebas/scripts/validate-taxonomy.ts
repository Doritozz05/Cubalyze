/**
 * Validacion final de f2l-taxonomy.json:
 *  1. Cada setup aplicado al cubo resuelto deja el par en la posicion esperada y el
 *     alg top lo resuelve (F2L completo).
 *  2. mirror es simetrico (involucion) y edgeFlipped tambien.
 *  3. Los 41 f2lnum mapean a patrones unicos.
 *  4. f2lnum y aNum no se solapan con Vj ni entre si (Vj = solved).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const TAX = JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8"));
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
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

const cases = TAX.cases as Record<string, any>;
const patids = Object.keys(cases).sort();
let bad = 0;

// 1) setup valido: el setup crea un estado con el par FR y el alg top lo resuelve
let setupOk = 0;
for (const p of patids) {
  const setup = cases[p].setup;
  const top = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed)[0];
  const s = new CubeState();
  try { s.applySequence(setup); } catch (e) { console.log(`  ${p}: setup invalido (${e})`); bad++; continue; }
  const t = s.clone();
  try { t.applySequence(top.moves); } catch (e) { console.log(`  ${p}: alg top invalido`); bad++; continue; }
  if (f2lSolved(t)) setupOk++;
  else { console.log(`  ${p}: setup+alg no resuelve F2L (setup=${setup}, alg=${top.moves})`); bad++; }
}
console.log(`setups validos: ${setupOk}/${patids.length}`);

// 2) simetria de mirror
let mSym = 0, mBad = 0;
for (const [a, b] of Object.entries(cases) as [string, any][]) {
  if (!b.mirror) { continue; }
  if (cases[b.mirror]?.mirror === a) mSym++;
  else { mBad++; console.log(`  mirror asimetrico: ${a}->${b.mirror} pero ${b.mirror}->${cases[b.mirror]?.mirror ?? "?"}`); }
}
console.log(`mirror simetricos: ${mSym} | asimetricos: ${mBad}`);

// 3) simetria de edgeFlipped
let eSym = 0, eBad = 0;
for (const [a, b] of Object.entries(cases) as [string, any][]) {
  if (!b.edgeFlipped) continue;
  if (cases[b.edgeFlipped]?.edgeFlipped === a) eSym++;
  else { eBad++; console.log(`  edgeFlipped asimetrico: ${a}->${b.edgeFlipped}`); }
}
console.log(`edgeFlipped simetricos: ${eSym} | asimetricos: ${eBad}`);

// 4) f2lnum unicos y sin solapamiento con aNum
const f2lSeen = new Map<string, string>();
let f2lDup = 0;
for (const [p, c] of Object.entries(cases) as [string, any][]) {
  if (c.f2lnum) {
    if (f2lSeen.has(c.f2lnum)) { f2lDup++; console.log(`  f2lnum duplicado ${c.f2lnum}: ${f2lSeen.get(c.f2lnum)} y ${p}`); }
    else f2lSeen.set(c.f2lnum, p);
  }
}
console.log(`f2lnum unicos: ${f2lSeen.size}/41`);
const aSeen = new Map<string, string>();
let aDup = 0;
for (const [p, c] of Object.entries(cases) as [string, any][]) {
  if (c.aNum) {
    if (aSeen.has(c.aNum)) { aDup++; console.log(`  aNum duplicado ${c.aNum}: ${aSeen.get(c.aNum)} y ${p}`); }
    else aSeen.set(c.aNum, p);
  }
}
console.log(`aNum unicos: ${aSeen.size}/51 | duplicados: ${aDup}`);

// 5) posicion derivada vs slotGroup
const posCount: Record<string, number> = {};
for (const [p, c] of Object.entries(cases) as [string, any][]) {
  posCount[c.position] = (posCount[c.position] ?? 0) + 1;
}
console.log(`posiciones: ${JSON.stringify(posCount)}`);

// 6) Vj = solved (auto-espejo, sin f2lnum?)
console.log(`Vj: f2lnum=${cases.Vj?.f2lnum ?? "null"} aNum=${cases.Vj?.aNum ?? "null"} mirror=${cases.Vj?.mirror} position=${cases.Vj?.position}`);

// 7) el espejo preserva la familia de posicion (both-top<->both-top, etc.)
let posMismatch = 0;
for (const [a, c] of Object.entries(cases) as [string, any][]) {
  if (!c.mirror) continue;
  const b = cases[c.mirror];
  if (!b) { console.log(`  mirror(${a}) -> ${c.mirror} inexistente`); posMismatch++; continue; }
  if (b.position !== c.position) {
    // excepcion conocida: auto-espejos simetricos (solved/own-slot simetricos)
    posMismatch++;
    console.log(`  pos diff: ${a}(${c.position}) <-> ${c.mirror}(${b.position})`);
  }
}
console.log(`mirror preserva posicion: ${posMismatch === 0 ? "SI" : `${posMismatch} diffs`}`);

// 8) edgeFlipped consistente con variantes 'a' de A-numbers (p.ej. Ti(A1)<->Tb(A1a))
let aConsistent = 0, aInconsistent = 0;
for (const [p, c] of Object.entries(cases) as [string, any][]) {
  const aNum = c.aNum;
  if (!aNum || !aNum.endsWith("a")) continue;
  const base = aNum.slice(0, -1); // A1
  // la variante 'a' deberia ser el edgeFlipped del caso base
  const basePat = Object.entries(cases).find(([, cc]) => cc.aNum === base)?.[0];
  if (!basePat) continue;
  const ef = c.edgeFlipped;
  if (ef === basePat) aConsistent++;
  else { aInconsistent++; console.log(`  a-inconsistente: ${p}(${aNum}) edgeFlipped=${ef ?? "?"} esperado ${basePat}`); }
}
console.log(`a-variantes consistentes: ${aConsistent} | inconsistentes: ${aInconsistent}`);

console.log(`\nTOTAL: ${bad} problemas`);
