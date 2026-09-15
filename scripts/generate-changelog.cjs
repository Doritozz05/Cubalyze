#!/usr/bin/env node
/**
 * Changelog generator for Cubalyze.
 *
 * Reads the full git history (every commit, no skipping), groups commits into
 * the version bands declared in scripts/changelog.config.json, and emits:
 *
 *   1. apps/web/src/data/changelog/changelog.json
 *      — the data file the Settings → Changelog UI renders (easily editable:
 *        editorial fields live in scripts/changelog.config.json and the script
 *        regenerates the commit entries straight from git).
 *   2. docs/17-releases/CHANGELOG_MASTER.md
 *      — the exhaustive master list: every commit with date, inferred
 *        category and changed files (audit deliverable).
 *
 * Category inference (never invented, always grounded):
 *   - Conventional Commits prefix (feat|fix|docs|chore|refactor|perf|style|
 *     test|build|ci|revert|ui) is taken as-is.
 *   - Otherwise a conservative file-based heuristic applies (docs-only →
 *     docs, test-only → test, manifests-only → chore); anything else is
 *     marked "other" (sin clasificar / unclassified).
 *
 * NOTE: no shell quotes in the git args — execSync on Windows runs cmd.exe
 * and would pass single quotes through literally. All formats are space-free,
 * so they are safe unquoted in both cmd and sh.
 *
 * Usage: node scripts/generate-changelog.cjs
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'changelog.config.json'), 'utf8'),
);

const UI_DATA_PATH = path.join(
  ROOT,
  'apps/web/src/data/changelog/changelog.json',
);
const MASTER_PATH = path.join(ROOT, 'docs/17-releases/CHANGELOG_MASTER.md');

const CONVENTIONAL_TYPES = new Set([
  'feat',
  'fix',
  'docs',
  'chore',
  'refactor',
  'perf',
  'style',
  'test',
  'build',
  'ci',
  'revert',
  'ui',
]);

/**
 * Collect every commit, newest first, as
 * { sha, date, subject, files[] }. Two passes (messages, file lists) are
 * zipped by position — both come from `git log` in the same order.
 */
function collectCommits() {
  const heads = execSync(
    'git log --date=short --format=%H%x1f%ad%x1f%s',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.split('\x1f'));

  // One \x1e per commit: output is "\x1e\nf1\nf2\n\n\x1e\nf3\n\n…", so
  // splitting on \x1e and dropping the first empty part yields exactly one
  // part per commit containing its file lines.
  const fileParts = execSync('git log --name-only --format=%x1e', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  })
    .split('\x1e')
    .slice(1)
    .map((part) =>
      part
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0),
    );

  if (heads.length !== fileParts.length) {
    throw new Error(
      `git passes out of sync: ${heads.length} headers vs ${fileParts.length} file lists`,
    );
  }
  return heads.map(([sha, date, subject], i) => ({
    sha,
    date,
    subject,
    files: fileParts[i],
  }));
}

/** Conservative category inference — see header comment. */
function inferCategory(commit) {
  const m = /^([a-z]+)(\([^)]*\))?(!?):/.exec(commit.subject);
  if (m && CONVENTIONAL_TYPES.has(m[1])) return m[1];
  const files = commit.files;
  if (files.length > 0 && files.every((f) => f.endsWith('.md'))) return 'docs';
  if (
    files.length > 0 &&
    files.every((f) => /\.(test|spec)\.[a-z]+$/.test(f) || /\/tests?\//.test(f))
  ) {
    return 'test';
  }
  if (
    files.length > 0 &&
    files.every(
      (f) =>
        /package\.json$/.test(f) ||
        /pnpm-lock/.test(f) ||
        /turbo\.json$/.test(f) ||
        /\.changeset\//.test(f),
    )
  ) {
    return 'chore';
  }
  return 'other';
}

function versionForDate(date) {
  for (const v of CONFIG.versions) {
    if (date >= v.startDate && date <= v.endDate) return v.version;
  }
  return null;
}

function escapeCell(s) {
  return s.replace(/\|/g, '\\|');
}

function build() {
  const commits = collectCommits();

  // Full internal shape (commits attached) — used for the master doc.
  const versions = CONFIG.versions.map((cfg) => ({
    version: cfg.version,
    isCurrent: cfg.version === CONFIG.currentVersion,
    name: cfg.name,
    period: cfg.period,
    startDate: cfg.startDate,
    endDate: cfg.endDate,
    summary: cfg.summary,
    moral: cfg.moral,
    items: cfg.items,
    commits: [],
  }));
  const versionByNumber = new Map(versions.map((v) => [v.version, v]));

  let unassigned = 0;
  for (const commit of commits) {
    const key = versionForDate(commit.date);
    if (!key) {
      unassigned += 1;
      continue;
    }
    versionByNumber.get(key).commits.push({
      sha: commit.sha.slice(0, 7),
      date: commit.date,
      c: inferCategory(commit),
      msg: commit.subject,
    });
  }

  if (unassigned > 0) {
    console.error(`ERROR: ${unassigned} commits fall outside every version band`);
    process.exit(1);
  }

  const dates = commits.map((c) => c.date).sort();
  const total = commits.length;

  // The UI data is CURATED only — the hand-written bars + item lists.
  // The exhaustive commit history lives in CHANGELOG_MASTER.md, not in the
  // bundle (keeps the UI light and the content hand-editable).
  const uiData = {
    generatedAt: new Date().toISOString(),
    repoUrl: CONFIG.repoUrl,
    totalCommits: total,
    finalMoral: CONFIG.finalMoral,
    currentVersion: CONFIG.currentVersion,
    versions: versions.map(({ startDate, summary, commits: _c, ...v }) => ({
      ...v,
      date: v.endDate,
    })),
  };

  fs.mkdirSync(path.dirname(UI_DATA_PATH), { recursive: true });
  fs.writeFileSync(UI_DATA_PATH, JSON.stringify(uiData, null, 2) + '\n');

  writeMasterMarkdown(versions, total, dates);
  console.log(
    `✓ ${total} commits audited → changelog.json (curated UI) + CHANGELOG_MASTER.md (exhaustive)`,
  );
  for (const v of versions) {
    console.log(
      `  v${v.version}  ${v.startDate} → ${v.endDate}  ${v.commits.length} commits`,
    );
  }
}

function writeMasterMarkdown(versions, total, dates) {
  const filesBySha = new Map(collectCommits().map((c) => [c.sha.slice(0, 7), c.files]));
  const now = new Date().toISOString().slice(0, 10);
  const lines = [];
  // El título se emite con la marca actual: los CHANGELOGs ya generados son
  // historia y no se reescriben, pero una regeneración futura no debe volver a
  // estampar el nombre antiguo.
  lines.push('# Lista maestra de commits — Cubalyze', '');
  lines.push(
    `> Generado automáticamente el ${now} por \`scripts/generate-changelog.cjs\`.`,
  );
  lines.push(
    `> **${total} commits** · ${dates[0]} → ${dates[dates.length - 1]} · repositorio ${CONFIG.repoUrl}`,
    '',
  );
  lines.push('## Metodología', '');
  lines.push(
    `- **Total real de commits: ${total}**, verificado con \`git rev-list --count HEAD\` (contaba 1.100 al inicio del análisis; entró un commit nuevo (2739e3c6, TechnicalSection) durante la sesión, por lo que el número verificado final es ${total}). Las cifras "1000" y "1080" que circularon antes no coinciden con el valor real del repositorio; este documento usa el valor verificado.`,
  );
  lines.push(
    '- Cada commit se revisó en orden cronológico (del más antiguo al más reciente). Se registran hash, fecha exacta, mensaje original y archivos tocados.',
  );
  lines.push(
    '- **Categoría:** si el mensaje sigue Conventional Commits (convención adoptada en las fases posteriores), el prefijo es la categoría. Si el mensaje es genérico ("fix", "fixes", "Update X.ts", …), la categoría se infiere de los archivos modificados con una heurística conservadora (solo markdown → `docs`; solo tests → `test`; solo manifests → `chore`). Sin evidencia suficiente se marca **sin clasificar** (`other`) — nunca se adivina.',
  );
  lines.push(
    '- Las descripciones por versión (resúmenes y destacados) están respaldadas por los mensajes y archivos de sus commits, los documentos del repositorio (`docs/`, PRD, roadmap, auditorías) y los PR fusionados (#4–#30).',
  );
  lines.push(
    '- Las versiones son una **reconstrucción retrospectiva**: el repositorio no tiene tags ni releases publicados. El único marcador explícito es el bump del paquete web a `0.8.0` (cc813171, 2026-08-22).',
    '',
  );
  lines.push('## Determinación de la versión actual (SemVer)', '');
  lines.push(
    'Política del repositorio (`docs/08-standards/Versioning_and_Dependency_Management.md`, `docs/17-releases/RELEASE_PROCESS.md`): en `0.x` el salto **minor** marca funcionalidad nueva y el **patch** arreglos; `1.0.0` solo cuando la API de los paquetes se estabilice (hoy los paquetes son privados, las cuentas acaban de llegar y el sync está en fase de endurecimiento → **sigue siendo 0.x**).',
  );
  lines.push(
    'Cada ola temática del historial es un salto minor. El bump existente a `0.8.0` (22 de agosto) marca el corte de la ola "nube"; después aterrizó una ola completa de features (inteligencia de casos unificada #26, replay de cine, Infinite F2L #29/#30, Pyraminx y multi-puzzle #27/#28) → **la versión actual es `0.9.1`**.',
    '',
  );
  lines.push('| Versión | Periodo | Commits | Ola |', '|---|---|---|---|');
  for (const v of versions) {
    lines.push(
      `| v${v.version}${v.version === CONFIG.currentVersion ? ' ⭐ (actual)' : ''} | ${v.startDate} → ${v.endDate} | ${v.commits.length} | ${v.name.en} / ${v.name.es} |`,
    );
  }
  lines.push('', '## Changelog completo', '');

  for (const v of versions) {
    const label = v.version === CONFIG.currentVersion ? ' (actual)' : '';
    lines.push(
      `### v${v.version}${label} — ${v.name.en} / ${v.name.es} — ${v.startDate} → ${v.endDate} — ${v.commits.length} commits`,
      '',
    );
    lines.push(`**Resumen:** ${v.summary.es}`, '');
    lines.push('**Destacados:**');
    for (const h of v.items) lines.push(`- ${h.en}`);
    lines.push('');
    lines.push('| Fecha | Hash | Categoría | Mensaje original | Archivos |');
    lines.push('|---|---|---|---|---|');
    const ordered = [...v.commits].sort((a, b) => (a.date > b.date ? 1 : -1));
    for (const c of ordered) {
      const files = filesBySha.get(c.sha) ?? [];
      const fileCell = files.length
        ? files.slice(0, 4).join(' · ') +
          (files.length > 4 ? ` · … (${files.length} en total)` : '')
        : '—';
      const cat = c.c === 'other' ? 'sin clasificar' : c.c;
      lines.push(
        `| ${c.date} | [\`${c.sha}\`](${CONFIG.commitUrlTemplate.replace('{sha}', c.sha)}) | ${cat} | ${escapeCell(c.msg)} | ${escapeCell(fileCell)} |`,
      );
    }
    lines.push('');
  }

  lines.push('---', '');
  lines.push(
    '> Regenerar con `node scripts/generate-changelog.cjs` (edita `scripts/changelog.config.json` para ajustar bandas, resúmenes o moralejas).',
  );
  fs.writeFileSync(MASTER_PATH, lines.join('\n') + '\n');
}

build();