// TDD-0006 line-length gate: every .ts/.tsx source file must stay under
// MAX_LINES (1000). Existing files that already exceed the limit are tracked
// in ALLOWLIST as documented technical debt — the gate only fails on NEW
// violations, so the debt can only shrink, never grow.
//
// The threshold is deliberately generous: it catches only extreme outliers,
// not normal-sized files (the previous 300-line rule produced a huge
// allowlist and pushed teams into cosmetic splitting).
//
// Usage:
//   node scripts/lint-lines.cjs            # fail on new violations
//   node scripts/lint-lines.cjs --list     # print current debt, exit 0
//
// Read-only utility — never modifies anything.
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MAX_LINES = 1000;
const TS_EXTS = [".ts", ".tsx"];

// ── Allowlist: files that already exceed MAX_LINES (regenerated with --list).
// Each entry is the repo-relative path using forward slashes.
const ALLOWLIST = [
  // Frozen, append-only migration registry: every schema change adds a new
  // entry and older entries are never edited, so the file grows monotonically
  // by design. The rebuild migration 032 (sessions without puzzle_type +
  // trigger re-creation) pushed it over the line; splitting the registry
  // across files would break the single-array contract the worker, desktop
  // and the sync/db test suites import from. Needs a dedicated refactor if
  // the trend continues.
  "packages/database/src/migrations/migrations.ts",
  // Pre-existing debt on main (Pyraminx work, #27) — the file was already
  // 1190 lines before this branch; allowlisted so the gate reflects that the
  // violation predates this PR. ReplaySection grew with the multi-puzzle
  // replay renderers and needs a dedicated component split.
  "apps/web/src/components/Insights/ReplaySection.tsx",
  // Pre-existing debt on main (1028 lines before this branch): the training
  // repository accumulates one SQL method per feature. Allowlisted to keep
  // the gate green; needs a dedicated extraction pass.
  "packages/database/src/repositories/training.repository.ts",
  "apps/web/src/components/Insights/SolveAnalysisPanel.tsx",
  "apps/web/src/utils/importSolves.ts",
  "packages/cube-3d-engine/src/core/Cube3DEngine.ts",
  // Cohesive async replay engine (grip pre-roll, mid-solve chaining, seek/step
  // gates): 1055 lines after the grip-rotation fix (3df0562). Splitting it in
  // a cleanup commit would risk replay behavior — needs a dedicated refactor.
  "packages/cube-3d-engine/src/replay/ReplayEngine.ts",
  // Sync data-integrity regression suite (real migrations + real repos against
  // an in-memory sqlite-wasm + FakeCloud mirror): 1023 lines after the E2/E3
  // cloud-profile and identicon-seed cases. Splitting the shared FakeCloud
  // harness into a helper would duplicate the mirror — flagged for a dedicated
  // cleanup, kept together for now (same rationale as ReplayEngine above).
  "packages/sync-engine/src/__tests__/sync.integrity.test.ts",
  "packages/gan-protocol/src/gan-cube-protocol.ts",
  // Generated algorithm-catalog DATA (pruebas/scripts/generate_seed_catalog.py,
  // "DO NOT edit by hand"): flat tables of thousands of algorithm rows. Not
  // hand-written source — splitting them would break the generator contract.
  "packages/algorithm-db/src/seed/cfop-antipll.ts",
  "packages/algorithm-db/src/seed/cfop-cls.ts",
  "packages/algorithm-db/src/seed/cfop-ell.ts",
  "packages/algorithm-db/src/seed/cfop-f2l.ts",
  "packages/algorithm-db/src/seed/cfop-oll.ts",
  "packages/algorithm-db/src/seed/cfop-pll.ts",
  "packages/algorithm-db/src/seed/cfop-sv.ts",
  "packages/algorithm-db/src/seed/coll.ts",
  "packages/algorithm-db/src/seed/wv.ts",
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "dist", ".turbo", "coverage"].includes(e.name)) continue;
      walk(p, out);
    } else if (TS_EXTS.some((x) => e.name.endsWith(x)) && !e.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const allowed = new Set(ALLOWLIST);

const files = [...walk(path.join(ROOT, "apps")), ...walk(path.join(ROOT, "packages"))];
const over = [];
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n").length;
  if (lines > MAX_LINES) over.push({ rel: rel(f), lines });
}
over.sort((a, b) => b.lines - a.lines);

const listOnly = process.argv.includes("--list");
if (listOnly) {
  console.log(`Files over ${MAX_LINES} lines (${over.length}):`);
  for (const { rel: r, lines } of over) console.log(`${r} ${lines}`);
  console.log(`\nAllowlist entries: ${allowed.size}`);
  process.exit(0);
}

const newViolations = over.filter(({ rel: r }) => !allowed.has(r));
const removedDebt = [...allowed].filter((r) => !over.some(({ rel: x }) => x === r));

console.log(`TDD-0006: ${MAX_LINES}-line gate — ${over.length} files over limit, ${allowed.size} allowlisted, ${newViolations.length} new violations, ${removedDebt.length} entries no longer over limit.`);

if (removedDebt.length) {
  console.log(`\nℹ️  Allowlist entries that no longer need to be there (remove from ALLOWLIST):`);
  for (const r of removedDebt) console.log(`  - ${r}`);
}

if (newViolations.length) {
  console.error(`\n❌ TDD-0006 violated by ${newViolations.length} NEW file(s) over ${MAX_LINES} lines:`);
  for (const { rel: r, lines } of newViolations) console.error(`  ${r} (${lines})`);
  console.error(`\nRefactor the file(s) below ${MAX_LINES} lines, or — only if justified — add them to the ALLOWLIST in scripts/lint-lines.cjs.`);
  process.exit(1);
}

console.log(`✅ TDD-0006 OK: no new files over the line limit (${MAX_LINES}).`);
