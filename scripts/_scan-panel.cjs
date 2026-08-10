const fs = require("fs");
const files = fs
  .readdirSync("apps/web/public/reconstructions/data")
  .filter((f) => f.startsWith("chunk-"));

const byKey = new Map();
let cfop3 = 0;
let total = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync("apps/web/public/reconstructions/data/" + f, "utf8"));
  for (const r of d.solves) {
    total++;
    byKey.set(r.key, r);
    if (r.methodGroup === "CFOP" && r.puzzle === "3x3") cfop3++;
  }
}

console.log("total records:", total, "| CFOP 3x3:", cfop3);

// Check a known CFOP 3x3 record the user referenced earlier
for (const key of ["cuberoot-2510", "reconz-2510", "2510"]) {
  const r = byKey.get(key);
  if (r) {
    console.log("FOUND", key, "| method:", r.methodGroup, "| puzzle:", r.puzzle, "| text head:", JSON.stringify((r.text || "").split("\n")[0].slice(0, 60)));
  }
}

// List the first 8 CFOP 3x3 keys sorted, to know what the browser could click
let listed = 0;
for (const [k, r] of byKey) {
  if (r.methodGroup === "CFOP" && r.puzzle === "3x3") {
    console.log("CFOP3:", k, "| time:", r.time, "| scramble len:", (r.scramble || "").split(/\s+/).length);
    if (++listed >= 8) break;
  }
}
