// Extrae el objeto data embebido de cualquier página de caso de speedcube.quest (SvelteKit).
// Uso: node pruebas/scripts/extract-quest-case.cjs <code> [--quiet]
//   node pruebas/scripts/extract-quest-case.cjs mi
//   node pruebas/scripts/extract-quest-case.cjs vb
//   node pruebas/scripts/extract-quest-case.cjs ti
// Lee pruebas/raw/quest/jb-page-<code>.html y escribe pruebas/raw/quest/quest-<code>-data.json
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = process.argv[2];
const quiet = process.argv.includes("--quiet");
if (!code) { console.error("uso: extract-quest-case.cjs <code> [--quiet]"); process.exit(1); }

const SRC = path.resolve(__dirname, `../raw/quest/jb-page-${code}.html`);
const OUT = path.resolve(__dirname, `../raw/quest/quest-${code}-data.json`);
const src = fs.readFileSync(SRC, "utf8");
const scripts = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const blob = scripts.find((s) => s.includes("frVotes"));
if (!blob) throw new Error(`blob no encontrado en ${SRC}`);

function balanced(str, i) {
  const open = str[i];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, out = "";
  for (let j = i; j < str.length; j++) {
    const ch = str[j];
    if (ch === '"' && str[j - 1] !== "\\") inStr = !inStr;
    if (!inStr) {
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return out + ch;
      }
    }
    out += ch;
  }
  return out;
}

const start = blob.search(/\{\s*type:\s*"data"/);
if (start < 0) throw new Error(`ancla {type:"data" no encontrado en ${SRC}`);
const objText = balanced(blob, start);
const parsed = vm.runInNewContext("(" + objText + ")");
const d = parsed.data;

if (!quiet) {
  console.log(`=== ${code} ===`);
  console.log("selected:", JSON.stringify(d.selected));
  console.log("setup:", d.selectedSetup);
  console.log("patterns:", JSON.stringify(d.patterns));
  console.log("grandTotal:", d.grandTotal, "| total:", JSON.stringify(d.total));
  const rows = d.rows;
  console.log("rows keys:", Object.keys(rows));
  const a = Array.isArray(rows.a) ? rows.a : [];
  console.log(`rows.a: ${a.length} filas | top-5:`);
  const sorted = [...a].sort((x, y) => (y.uses ?? 0) - (x.uses ?? 0));
  for (const r of sorted.slice(0, 5)) {
    console.log(`  ${r.auf ? r.auf + " " : ""}${r.alg} (${r.algid}) uses=${r.uses} front=${r.frontUses} back=${r.backUses} disturbs=${JSON.stringify(r.disturbs)} reduces=${JSON.stringify((r.reduces ?? []).map((x) => x.case))}`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(parsed.data, null, 1));
if (!quiet) console.log(`\nvolcado completo -> ${OUT}`);
