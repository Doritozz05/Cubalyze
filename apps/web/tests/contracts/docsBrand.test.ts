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
 *
 * The same guard covers the METADATA (`*.json`) and the Mermaid diagrams
 * (`*.mmd`), because those sit outside a prose sweep and a JSON value is exactly
 * where a name hides in plain sight: `"project": "CubeForge"`, `"name":
 * "CubeForge API Reference"`. There the rule needs one adjustment — see
 * `isMetadataMention` — and one case it cannot decide by shape at all, which is
 * why the root package name is asserted by VALUE.
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
function trackedFiles(...patterns: string[]): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--', ...patterns], {
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

/**
 * En prosa, unas comillas significan «esto es un nombre técnico».
 *
 * En JSON las comillas son SINTAXIS: `"project": "CubeForge"` es una mención en
 * prosa, no una cita. Si la regla de arriba se aplicara tal cual, **cada valor de
 * cada fichero JSON quedaría exento** y la guarda no vería absolutamente nada — el
 * fallo perfecto: verde, grande y ciego. Por eso aquí se quitan las comillas de la
 * lista de caracteres que eximen.
 */
const TECHNICAL_BEFORE_METADATA = /[@/\\:._()[\]-]/;

function isMetadataMention(text: string, at: number, form: string): boolean {
  const before = at > 0 ? text[at - 1] : '';
  if (TECHNICAL_BEFORE_METADATA.test(before)) return false;
  const after = text.slice(at + form.length, at + form.length + 12);
  // Un sufijo (`cubeforge-locker`) o un dominio (`.desktop`) siguen siendo técnicos.
  if (TECHNICAL_AFTER.test(after)) return false;
  if (/^\.[a-z]{2,}/i.test(after)) return false;
  return true;
}

function metadataMentions(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(LEGACY_GLOBAL)) {
    if (isMetadataMention(text, match.index ?? 0, match[0])) found.push(match[0]);
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
  const all = trackedFiles('*.md');
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

describe('docs brand — la regla de metadatos, probada en sí misma', () => {
  it('marca un valor en prosa aunque vaya entre comillas', () => {
    for (const bad of [
      '"project": "CubeForge"',
      '{ "name": "CubeForge API Reference" }',
      'title: Cubeforge — flujo de datos',
      '"description": "Default capabilities for CubeForge desktop"',
    ]) {
      expect(metadataMentions(bad), `debería ser residuo: ${bad}`).not.toEqual([]);
    }
  });

  it('no marca identificadores, rutas, URLs ni claves', () => {
    for (const ok of [
      '"identifier": "com.cubeforge.desktop"',
      '"commitUrlTemplate": "https://github.com/Doritozz05/Cubeforge/commit/{sha}"',
      '"homepage": "https://cubeforge-phi.vercel.app/"',
      '"formatNameCubeforgeCsv": "Cubalyze CSV"',
      '"key": "cubeforge-locker"',
      '"path": "cubeforge/"',
    ]) {
      expect(metadataMentions(ok), `no debería marcarse: ${ok}`).toEqual([]);
    }
  });
});

describe('docs brand — metadatos y diagramas sin el nombre antiguo', () => {
  const all = trackedFiles('*.json', '*.mmd');
  const live = all.filter((rel) => !isHistory(rel) && rel !== AUDIT_DOC);

  it('la lista viene del repositorio y trae contenido (una guarda que lee 0 ficheros pasa en falso)', () => {
    expect(
      all.length,
      'git no devolvió metadatos: la guarda está mirando al sitio equivocado.',
    ).toBeGreaterThan(20);
    expect(live.length).toBeGreaterThan(20);
  });

  it('ningún metadato vivo conserva el wordmark antiguo', () => {
    const offenders: string[] = [];
    for (const rel of live) {
      const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
      for (const form of metadataMentions(text)) offenders.push(`${rel} → «${form}»`);
    }
    expect(
      offenders,
      'Un JSON o un diagrama VIVO vuelve a nombrar la marca antigua.\n' +
        'Los identificadores (`com.cubeforge.desktop`, `cubeforge-locker`), las claves de i18n\n' +
        'y las URLs son legítimos y la regla los exime; un valor en prosa no.\n' +
        '`apps/desktop/src-tauri/gen/**` es salida de `tauri build` generada desde\n' +
        '`capabilities/default.json`, así que se mantiene limpio por su origen.',
    ).toEqual([]);
  });

  it('el paquete raíz no vuelve al nombre antiguo (la forma no puede decidirlo)', () => {
    // `cubeforge-monorepo` y `cubeforge-prefs` tienen la MISMA forma: palabra +
    // sufijo tras un guion. La regla no puede separarlos — el primero es un nombre que
    // renombramos, el segundo una clave congelada que no se puede tocar sin perder
    // datos (ver storageContract.test.ts). Cuando la forma no puede decidir, se afirma
    // por VALOR.
    const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      name?: string;
    };
    expect(root.name).toBe('cubalyze-monorepo');
  });
});
