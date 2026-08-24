// Extrae del HTML descargado de quest (jb-page-now.html) el contexto de "F2L 2",
// del setup "B' R B R'" y de los algs de la pagina 2, para entender la estructura.
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../raw/quest/jb-page-now.html", "utf-8");

function context(needle, before = 260, after = 420) {
  const i = src.indexOf(needle);
  if (i < 0) return `"${needle}" NO ENCONTRADO`;
  return src.slice(Math.max(0, i - before), i + after).replace(/\s+/g, " ");
}

console.log("=== contexto de 'F2L 2' ===");
console.log(context("F2L 2", 300, 300));
console.log("\n=== contexto de \"B' R B R'\" ===");
console.log(context("B' R B R'", 400, 300));
console.log("\n=== contexto de \"U' R' U R\" ===");
console.log(context("U' R' U R", 400, 300));

// buscar el estado serializado (blob grande con frVotes)
const iFr = src.indexOf("frVotes");
console.log("\n=== pos de frVotes:", iFr, "===");
if (iFr > 0) {
  console.log(src.slice(Math.max(0, iFr - 300), iFr + 500).replace(/\s+/g, " "));
}

// cuantos F2L 2 hay y su contexto de codigo de caso
let idx = -1, n = 0;
const hits = [];
while ((idx = src.indexOf("F2L 2", idx + 1)) >= 0 && n < 12) {
  const ctx = src.slice(Math.max(0, idx - 90), idx + 30).replace(/\s+/g, " ");
  hits.push(ctx);
  n++;
}
console.log("\n=== contexto corto de cada 'F2L 2' ===");
hits.forEach((h, i) => console.log(`  [${i}] ...${h}...`));
