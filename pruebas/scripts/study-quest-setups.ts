/**
 * Estudio: setups de quest (13 páginas descargadas) vs nuestra taxonomía.
 * Para cada caso: setup quest → pareja identifyPair + piezas F2L fuera.
 * setup nuestro (taxonomía) → lo mismo. ¿Coinciden?
 *
 * Nota: quest usa notación "L2'" (doble + prima) = L2. Normalizamos.
 */
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;

const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number; kind: string } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c], kind: "trapped-corner" };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e, kind: "trapped-edge" };
  return { homeC: 4, homeE: 8, kind: "basic" };
}
const findPos = (arr: readonly number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};
function analyze(setup: string | undefined) {
  if (!setup) return { err: "sin setup", norm: "" };
  const norm = setup.replace(/([RLUDFBMES]w?|[rludbf])2'/g, "$12").replace(/’/g, "'");
  let s: CubeState;
  try {
    s = new CubeState();
    s.applySequence(norm);
  } catch (e) {
    return { err: String(e), norm };
  }
  const pair = identifyPair(s);
  const out: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) out.push(`C${c}`);
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) out.push(`E${e}`);
  return { pair, out, nOut: out.length, norm };
}

for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  // Quest usa el patid canónico: primera letra mayúscula, resto minúscula.
  const patid = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const m = src.match(/selectedSetup:\s*"([^"]+)"/);
  const nameM = src.match(/name:\s*"([^"]+)"/);
  const basicM = src.match(/basic:\s*(true|false)/);
  if (!m) { console.log(`${patid}: sin selectedSetup`); continue; }
  const q = analyze(m[1]);
  const ours = TAX[patid];
  const o = analyze(ours?.setup);
  const basic = basicM ? basicM[1] === "true" : "?";
  console.log(`\n=== ${patid} (${basic ? "BASIC" : "ADVANCED"}) ===`);
  console.log(`  quest name: "${nameM ? nameM[1] : "?"}"`);
  if (!q.pair) { console.log(`  quest setup: ${q.norm} — ERROR ${q.err}`); continue; }
  console.log(`  quest setup: ${q.norm}`);
  console.log(`    (${q.nOut} fuera: ${q.out.join(" ")}) pareja {${q.pair.homeC},${q.pair.homeE}} ${q.pair.kind}`);
  if (o && o.pair) {
    const same = q.nOut === o.nOut && q.pair.homeC === o.pair.homeC && q.pair.homeE === o.pair.homeE;
    console.log(`  nuestro:     ${o.norm}`);
    console.log(`    (${o.nOut} fuera: ${o.out.join(" ")}) pareja {${o.pair.homeC},${o.pair.homeE}} ${o.pair.kind} ${same ? "✅ IGUAL" : "❌ DIFIERE"}`);
  } else {
    console.log(`  nuestro: no está en taxonomía`);
  }
}
