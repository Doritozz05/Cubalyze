/**
 * Brand residue guard — LIVE documentation.
 *
 * The rebranding sweep renamed the wordmark in every living document. Two classes
 * of file must keep the old name, and this guard asserts that only those two do:
 *
 *   1. HISTORY — the generated changelogs and the archived plans. They record what
 *      the project was called at the time; rewriting them would falsify when each
 *      thing happened.
 *   2. TECHNICAL NAMES — storage keys, file paths, URLs, the Rust crate and the
 *      Tauri identifier. They are lowercase on purpose and are contracts with data
 *      that already exists on users' devices (see storageContract.test.ts).
 *
 * The rule is NOT "does the string appear" — that would flag every legitimate
 * `cubeforge-prefs` and every link to the still-unrenamed GitHub repo. The rule is
 * "is this a WORDMARK mention in prose". `isWordmarkMention` tells the two apart,
 * and it has its own unit tests: a rule exercised only through its application is
 * a rule nobody has ever checked.
 *
 * The rebranding audit itself is a THIRD class, and it is temporary: it has to
 * name the old brand to be able to describe the change. Its entry asserts the file
 * still exists, so the day the document is archived or deleted this guard fails
 * and forces the exception to be cleaned up instead of lingering as dead weight.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

/** The audit is a documented, self-expiring exception — see the header. */
const AUDIT_DOC = 'docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md';

/** History: never rewritten, so the old name legitimately lives here forever. */
function isHistory(rel: string): boolean {
  return (
    rel.endsWith('CHANGELOG.md') ||
    rel === 'docs/17-releases/CHANGELOG_MASTER.md' ||
    rel.startsWith('docs/18-archive/')
  );
}

/**
 * Los documentos salen de `git ls-files`, no de recorrer el disco: la definición
 * de «el repositorio» es el repositorio.
 *
 * No es un detalle de estilo. Recorrer el disco incluye los borradores locales
 * ignorados (`pruebas/*` está en .gitignore y tiene análisis y reportes propios),
 * así que el test haría cosas distintas en dos máquinas — y de hecho fue lo que
 * pasó al escribir esta guarda: marcó dos borradores que no forman parte del
 * proyecto.
 */
function trackedMarkdown(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

/** Any spelling of the legacy wordmark (used only to find candidates). */
const LEGACY_GLOBAL = /cube[ _.-]?forge/gi;
/** The same, non-global: safe to `.test()` repeatedly (global regexes carry state). */
const LEGACY = /cube[ _.-]?forge/i;

/** A character that turns the mention into part of a technical name. */
const TECHNICAL_BEFORE = /[@/\\:."'`_()-]/;
/** …or one that continues it: `cubeforge-prefs`, `cubeforge:widgets`, `cubeforge_x`. */
const TECHNICAL_AFTER = /^[\w:/_-]/;

/**
 * ¿La mención es el wordmark en prosa, o parte de un nombre técnico?
 *
 * `CubeForge` en prosa → sí (residuo). `` `cubeforge-prefs` `` → no (clave).
 * `cubeforge.db` · `cubeforge_lib::run()` · `sqlite:cubeforge.db` · `docs.cubeforge.com`
 * · `github.com/…/Cubeforge` → no (nombres técnicos, aún sin renombrar a propósito).
 */
function isWordmarkMention(text: string, at: number, form: string): boolean {
  const before = at > 0 ? text[at - 1] : '';
  if (TECHNICAL_BEFORE.test(before)) return false;
  const after = text.slice(at + form.length, at + form.length + 12);
  if (TECHNICAL_AFTER.test(after)) return false;
  // `.` solo exime si le siguen letras (un dominio o una extensión): así
  // «…a cubeforge.» al final de una frase sí falla, como debe.
  if (/^\.[a-z]{2,}/i.test(after)) return false;
  return true;
}

/** Todas las menciones del wordmark antiguo en un texto. */
function wordmarkMentions(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(LEGACY_GLOBAL)) {
    if (isWordmarkMention(text, match.index ?? 0, match[0])) found.push(match[0]);
  }
  return found;
}

describe('docs brand — la regla, probada en sí misma', () => {
  it('reconoce el wordmark en prosa', () => {
    for (const bad of ['CubeForge', 'La app CubeForge', 'cubeforge es la app', 'CUBEFORGE']) {
      expect(wordmarkMentions(bad), `debería ser residuo: ${bad}`).not.toEqual([]);
    }
  });

  it('no confunde identificadores técnicos con el wordmark', () => {
    for (const ok of [
      '`cubeforge-prefs`',
      '`cubeforge:widgets`',
      '`cubeforge_snap_3d_v8_`',
      'sqlite:cubeforge.db',
      'com.cubeforge.desktop',
      'cubeforge_lib::run()',
      'docs.cubeforge.com',
      'https://github.com/Doritozz05/Cubeforge',
      'cubeforge/',
    ]) {
      expect(wordmarkMentions(ok), `no debería marcarse: ${ok}`).toEqual([]);
    }
  });

  it('marca una mención al final de frase (el punto no es una extensión)', () => {
    expect(wordmarkMentions('Esto era cubeforge.')).toEqual(['cubeforge']);
  });
});

describe('docs brand — documentación viva sin el nombre antiguo', () => {
  const all = trackedMarkdown();
  const live = all.filter((rel) => !isHistory(rel) && rel !== AUDIT_DOC);

  it('la lista viene del repositorio y trae contenido (una guarda que lee 0 ficheros pasa en falso)', () => {
    expect(
      all.length,
      'git no devolvió documentos: la guarda está mirando al sitio equivocado.',
    ).toBeGreaterThan(100);
    expect(live.length).toBeGreaterThan(100);
  });

  it('ningún documento vivo conserva el wordmark antiguo', () => {
    const offenders: string[] = [];
    for (const rel of live) {
      const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
      for (const form of wordmarkMentions(text)) offenders.push(`${rel} → «${form}»`);
    }
    expect(
      offenders,
      'Un documento VIVO vuelve a nombrar la marca antigua. La historia (changelogs y\n' +
        'archivados) y los nombres técnicos en minúscula son legítimos; una mención en prosa no.\n' +
        'Si el fichero describe el pasado, muévelo a docs/18-archive y añádelo a isHistory().',
    ).toEqual([]);
  });

  it('la excepción del documento de auditoría sigue viva (caduca sola)', () => {
    // Si el documento se archiva o se borra, esta línea falla y obliga a limpiar
    // la excepción en vez de dejarla ahí para siempre.
    expect(existsSync(join(REPO_ROOT, AUDIT_DOC)), `${AUDIT_DOC} ya no existe`).toBe(true);
    expect(readFileSync(join(REPO_ROOT, AUDIT_DOC), 'utf8')).toMatch(LEGACY);
  });

  it('la historia sigue siendo historia (si deja de nombrarla, la exclusión sobra)', () => {
    const master = 'docs/17-releases/CHANGELOG_MASTER.md';
    expect(existsSync(join(REPO_ROOT, master))).toBe(true);
    expect(
      readFileSync(join(REPO_ROOT, master), 'utf8'),
      'El registro histórico ya no nombra la marca antigua: entonces ya no hay nada que excluir.',
    ).toMatch(LEGACY);
  });
});
