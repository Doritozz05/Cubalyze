// Scans apps/web/src for files that are never imported by anything.
// Unlike naive basename matching, this resolves each import specifier
// (relative ./x, ../x, and @/ alias) against the importing file's real
// directory, so barrel index.ts and same-name files are handled correctly.
//
// Read-only utility — never modifies anything. Excludes entry points,
// test/spec files and ambient .d.ts files (valid non-imported infra).
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "apps", "web", "src");
const TS_EXTS = [".ts", ".tsx"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".turbo" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (TS_EXTS.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(SRC);
const rel = (p) => path.relative(SRC, p).split(path.sep).join("/");

/** Try to resolve an import specifier to a src-relative path (no extension). */
function resolveSpecifier(spec, fromDirAbs) {
  let base;
  if (spec.startsWith("@/")) {
    base = path.join(SRC, spec.slice(2));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path.resolve(fromDirAbs, spec);
  } else {
    return null; // bare package import — not a local file
  }
  // Try exact, then each TS extension (resolve("./X") → X.ts / X.tsx / X/index.ts...)
  const candidates = [base, ...TS_EXTS.map((x) => base + x), ...TS_EXTS.map((x) => path.join(base, "index" + x))];
  for (const c of candidates) {
    const abs = c; // already absolute
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const r = rel(abs);
      if (r && !r.startsWith("..")) return r.replace(/\.(ts|tsx)$/, "");
    }
  }
  // Directory import (./foo with foo/index.ts handled above); also allow
  // specifier that points into a directory that has an index.* file.
  return null;
}

/** Strip // line and /* block *\/ comments so comment mentions of "from x"
 *  never count as real imports (multi-line imports are still matched). */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Build a set of every src-relative path (without extension) that is imported.
const imported = new Set();
for (const f of files) {
  const text = stripComments(fs.readFileSync(f, "utf8"));
  const fromDirAbs = path.dirname(f);
  // Static imports: `from "spec"` (covers single and multi-line import/export
  // statements) and side-effect imports `import "spec"`.
  // Dynamic imports: `import("spec")`.
  const re = /\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|(?:^|[;\n])\s*\bimport\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const spec = m[1] ?? m[2] ?? m[3];
    const resolved = resolveSpecifier(spec, fromDirAbs);
    if (resolved) imported.add(resolved);
  }
}

const orphans = [];
for (const f of files) {
  const r = rel(f);
  if (r === "main.tsx" || r === "App.tsx" || r === "index.css") continue; // entry points
  if (/\.(test|spec)\.(ts|tsx)$/.test(r)) continue; // vitest entry points
  if (/\.d\.ts$/.test(r)) continue; // ambient declarations (loaded by TS/Vite)

  const key = r.replace(/\.(ts|tsx)$/, "");
  if (!imported.has(key)) orphans.push(r);
}

console.log("=== POSIBLES ARCHIVOS HUERFANOS (nunca importados) ===");
console.log(orphans.length ? orphans.join("\n") : "(ninguno)");
