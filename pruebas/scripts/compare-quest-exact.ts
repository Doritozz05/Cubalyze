/**
 * Comparación EXACTA con quest:
 *  A) El mapeo F2L 1-41 -> código BirdF2L del sidebar de quest vs el nuestro.
 *  B) Cada fila de jb-data.json (59 algs de la página Jb) -> está en parsed.json?
 *     Con qué speed/rank? Resuelve S1 (el caso Jb real)?
 *  C) La lista de la página 2 pegada (top por back-usage) verificada.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/compare-quest-exact.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const QUEST = resolve(__dirname, "../raw/quest");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<
  string,
  { algs: { moves: string; speed: number }[] }
>;
const html = readFileSync(resolve(QUEST, "jb-page-now.html"), "utf-8");
const jb = JSON.parse(readFileSync(resolve(QUEST, "jb-data.json"), "utf-8"));

const patids = Object.keys(PARSED).sort();
const inParsed = new Map<string, { p: string; rank: number; n: number; speed: number }[]>();
for (const p of patids) {
  const sorted = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed);
  sorted.forEach((a, i) => {
    const arr = inParsed.get(a.moves) ?? [];
    arr.push({ p, rank: i + 1, n: sorted.length, speed: a.speed });
    inParsed.set(a.moves, arr);
  });
}

// ---------- A) Mapeo F2L 1-41 de quest vs nuestro ----------
const OUR: Record<string, string> = {
  "1": "Jb", "2": "Mi", "3": "Je", "4": "Ma", "5": "Ja", "6": "Me", "7": "Jd", "8": "Mq", "9": "Jq", "10": "Md",
  "11": "Jm", "12": "Mc", "13": "Ji", "14": "Mb", "15": "Jc", "16": "Mm", "17": "Cb", "18": "Ci", "19": "Ca", "20": "Ce",
  "21": "Cd", "22": "Cq", "23": "Cc", "24": "Cm", "25": "Vb", "26": "Vi", "27": "Kb", "28": "Pi", "29": "Ki", "30": "Pb",
  "31": "Cp", "32": "Cj", "33": "Jj", "34": "Mj", "35": "Jp", "36": "Mp", "37": "Vp", "38": "Kj", "39": "Pj", "40": "Kp", "41": "Pp",
};
const re = /title="F2L (\d+) \(SpeedCubeDB \d+\/\d+\) · ([A-Za-z0-9]+)"/g;
const QUEST_MAP = new Map<string, string>();
let m: RegExpExecArray | null;
while ((m = re.exec(html))) QUEST_MAP.set(m[1], m[2]);
console.log("=== A) MAPEO F2L 1-41: quest (sidebar) vs nuestro ===");
console.log(`quest tiene ${QUEST_MAP.size} entradas de las 41`);
let diffs = 0;
for (let n = 1; n <= 41; n++) {
  const q = QUEST_MAP.get(String(n));
  const o = OUR[String(n)];
  const same = q === o;
  if (!same) diffs++;
  console.log(`  F2L ${String(n).padStart(2)}: quest=${q ?? "?"}  nuestro=${o}  ${same ? "OK" : "*** DIFF ***"}`);
}
console.log(`diferencias: ${diffs}/41`);

// ---------- B) Filas de jb-data vs parsed.json ----------
console.log("\n=== B) FILAS DE jb-data.json (Jb, 59 algs) vs parsed.json ===");
const rows = (jb.rows as any).a as any[];
const S1 = new CubeState(); S1.applySequence("F R' F' R");
function fullAlg(r: any): string {
  const a = r.alg.trim();
  return r.auf ? `${r.auf} ${a}` : a;
}
function solvesJb(alg: string): boolean {
  const t = S1.clone();
  try { t.applySequence(alg); } catch { return false; }
  for (let i = 4; i < 8; i++) if (t.cp[i] !== i || t.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (t.ep[i] !== i || t.eo[i] !== 0) return false;
  return true;
}
console.log("  (ordenadas por uso total desc; mostrando las 20 primeras)");
let hitTop = 0, hitAll = 0, solveOk = 0;
const topSorted = [...rows].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));
topSorted.slice(0, 20).forEach((r, i) => {
  const full = fullAlg(r);
  const hits = inParsed.get(full);
  const h = hits?.length ? hits.map((x) => `${x.p}#${x.rank}/${x.n}·s${x.speed}`).join("|") : "-";
  if (hits) hitTop++;
  const s = solvesJb(full);
  if (s) solveOk++;
  console.log(`  #${i + 1} "${full}" (uses ${r.uses}, back ${r.backUses}) ${s ? "solves-Jb ✓" : "NO-solve"} | parsed: ${h}`);
});
for (const r of rows) if (inParsed.get(fullAlg(r))) hitAll++;
console.log(`\n  filas en parsed.json: ${hitAll}/${rows.length} | de las top-20 por uso: ${hitTop}/20 | de las top-20 que resuelven Jb: ${solveOk}/20`);

// ---------- C) La pagina 2 pegada (top por back-usage) ----------
console.log("\n=== C) LA LISTA PEGADA (pag.2, top por back-usage) — verificación fila a fila ===");
const byBack = [...rows].sort((a, b) => (b.backUses ?? 0) - (a.backUses ?? 0));
const pasted: [string, number][] = [
  ["U' R' U R", 5954], ["U2 R' U2 R", 1645], ["U' R' U' R U R' U R", 15], ["R B' R' B", 5],
  ["U2 R' U R U' R' U2 R", 5], ["R f' U' f", 4], ["U2 R' U2 F R F'", 4], ["U' l' B l", 2],
  ["l U' l' B", 2], ["U' R' F' U F R", 2], ["U' R' U' R U2 R B' R' B", 1], ["U' S' R' U R S", 1],
  ["R y' r' U' r", 1], ["U2 l' B2 l", 1], ["U' R U' R' U' R U' R'", 1], ["U2 R' U2 y F", 1],
  ["U' R' U R r U' r' F", 1], ["U' L' U L", 1],
];
let matched = 0;
for (const [disp, votes] of pasted) {
  // buscar la fila de quest con backUses == votes
  const row = byBack.find((r) => r.backUses === votes && solvesJb(fullAlg(r)));
  const full = row ? fullAlg(row) : null;
  const hits = full ? inParsed.get(full) : undefined;
  const h = hits?.length ? hits.map((x) => `${x.p}#${x.rank}/${x.n}·s${x.speed}`).join("|") : "-";
  if (full) matched++;
  console.log(`  "${disp}" (${votes}) -> fila quest "${full ?? "??"}" | parsed: ${h}`);
}
console.log(`\n  filas pegadas resueltas a filas de quest por backUses: ${matched}/${pasted.length}`);
