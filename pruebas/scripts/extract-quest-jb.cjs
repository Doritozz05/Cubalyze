// Extrae el objeto data embebido de la pagina Jb de speedcube.quest (SvelteKit).
// Uso: node pruebas/scripts/extract-quest-jb.cjs
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "../raw/quest/speedcube.quest_algorithms_f2l_jb.html");
const OUT = path.resolve(__dirname, "../raw/quest/jb-data.json");
const src = fs.readFileSync(SRC, "utf8");
const scripts = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const blob = scripts.find((s) => s.includes("frVotes"));
if (!blob) throw new Error("blob no encontrado");

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

const start = blob.indexOf('{ type: "data"');
const objText = balanced(blob, start);
const parsed = vm.runInNewContext("(" + objText + ")");
const d = parsed.data;

console.log("=== METADATA ===");
console.log("selected:", JSON.stringify(d.selected));
console.log("setup:", d.selectedSetup);
console.log("patterns:", JSON.stringify(d.patterns));
console.log("grandTotal:", d.grandTotal, "| total:", JSON.stringify(d.total));

const rows = d.rows;
console.log("\nrows keys:", Object.keys(rows));
for (const [k, arr] of Object.entries(rows)) {
  if (!Array.isArray(arr)) {
    console.log(`\n=== grupo '${k}': NO es array (typeof ${typeof arr}) ===`);
    console.log("  keys:", arr && typeof arr === "object" ? Object.keys(arr) : arr);
    if (arr && typeof arr === "object") {
      const first = Object.values(arr)[0];
      console.log("  primera entrada:", JSON.stringify(first).slice(0, 300));
    }
    continue;
  }
  console.log(`\n=== grupo '${k}': ${arr.length} filas ===`);
  for (const r of arr) {
    const line = [
      r.alg,
      "auf=" + (r.auf || "-"),
      "frV=" + (r.frVotes ?? "-"),
      "brV=" + (r.brVotes ?? "-"),
      "uses=" + (r.uses ?? "-"),
      "cub=" + (r.cubers ?? "-"),
      "front=" + (r.frontUses ?? "-"),
      "back=" + (r.backUses ?? "-"),
      "score=" + (r.score ?? "-") + "/" + (r.scoreBack ?? "-"),
      "disturbs=" + JSON.stringify(r.disturbs ?? "-"),
      "usesBy=" + JSON.stringify(r.usesBy ?? "-"),
      r.algid ?? "",
    ];
    console.log("  " + line.join(" "));
  }
}

// volcado completo a disco para el pipeline futuro
fs.writeFileSync(OUT, JSON.stringify(parsed.data, null, 1));
console.log(`\nvolcado completo -> ${OUT}`);
