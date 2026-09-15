/**
 * Artifact residue audit — the compiled bundle is the only place where the
 * RUNTIME strings actually survive: minification inlines every string literal,
 * so what this test sees is exactly what a user (or a curious DevTools user)
 * would see, and no source-level grep can hide anything from it.
 *
 * It was added after the artifact audit found things the source-level passes had
 * misclassified, most importantly a real import/export CONTRACT:
 *   • `exportSolves.ts` writes `app: "CubeForge"` inside the exported JSON and
 *     the `.xlsx` (`App` column) — a discriminator that travels in files the
 *     user already saved;
 *   • `importSolves.ts` REQUIRES it (`data.app === "CubeForge"`), so renaming the
 *     writer without teaching the reader breaks every backup made before today.
 *
 * How it stays honest:
 *   1. ALLOWED — frozen storage names and internal identifiers. Renaming them
 *      would orphan user data (see storageContract.test.ts), so they are
 *      permanent by design.
 *   2. PENDING — legacy strings still in the bundle, each tagged with the PR that
 *      removes it. Every entry SELF-EXPIRES: the test asserts the entry is still
 *      present, so once that PR lands the assertion fails and forces the entry to
 *      be deleted here instead of rotting.
 *   3. Anything else = a regression nobody has classified → the test fails and
 *      prints the exact context.
 *
 * Runs only when `apps/web/dist` exists (CI builds before testing).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const DIST = join(REPO_ROOT, 'apps/web/dist');
const hasDist = existsSync(DIST);

/**
 * Any spelling of the legacy wordmark (used only to locate candidates).
 * GLOBAL on purpose: `matchAll` and repeated `.test()` on a global regex share
 * `lastIndex` state, so every other pattern in this file is deliberately
 * non-global — mixing them is the classic silent-false-negative bug.
 */
const LEGACY_TOKEN_GLOBAL = /cube[ _.-]?forge/gi;

/**
 * Permanent exceptions: names that MUST keep the legacy spelling because they are
 * a contract with data already stored on user devices, or in-build identifiers.
 */
const FROZEN_WORD = [
  // Claves de localStorage, ids de formato, nombres de descarga y prefijos
  // dinámicos (`cubeforge:${flag}`, `cubeforge-${name}.csv`) → el sufijo puede
  // venir de una plantilla, así que basta con el separador.
  /^cubeforge[-:._][A-Za-z0-9:_.-]*$/,
  /^cubeforge_[A-Za-z0-9_]+$/, // claves OPFS/sahpool (cubeforge_snap_3d_v8_, cubeforge_puzzle…)
  /^cube-forge-db$/, // IndexedDB del snapshot
  // Globales de consola (`window.__cubeforgeLogs`, `e.__cubeforgeLastSolve__`…).
  // Se permite el prefijo de acceso al miembro (`e.`, `window.`) porque la
  // «palabra» extraída incluye el objeto al que pertenecen.
  /(^|\.)__(cubeforge|CubeForge)[A-Za-z0-9_]*$/,
  /^CubeforgeCompositeDigits$/, // familia tipográfica interna (¡la F va en minúscula!)
  /^cubeforge-composite-font$/, // id del <style> inyectado
  /^cubeforge_lib$/, // crate Rust
];

/** Una mención «desnuda» (sin sufijo) = copy visible o discriminador → exige clasificación. */
const BARE_WORD = /^cube[ _.-]?forge$/i;

/**
 * Contextos congelados para siempre: la marca aparece como DATO derivado, no como
 * copy, y cambiarla altera algo que el usuario ya tiene sin ningún beneficio.
 */
const FROZEN_CONTEXT = [
  {
    pattern: /@cubeforge\/[a-z0-9-]+/,
    why:
      'Referencia al scope dentro del SQL de una migración ya aplicada (el bundle lleva el SQL). ' +
      'Las migraciones son INMUTABLES: sus ids viven en la tabla `_migrations` de cada dispositivo.',
  },
  {
    pattern: /startsWith\(`cubeforge`\)/,
    why:
      'Acoplamiento por PREFIJO en AdvancedSection (botón «Borrar datos de la app» + inspector de ' +
      'almacenamiento). Congelado junto al resto de nombres; si algún día se renombran las claves, ' +
      'estas dos comprobaciones deben aceptar AMBOS prefijos o fallarán en silencio. ' +
      'Guardado también en storageContract.test.ts.',
  },
  {
    pattern: /[`'"]cubeforge[`'"],\s*[`'"]forgemark[`'"]/,
    why:
      'HASH_SALTS del identicon (packages/identicon): cambiarlos re-skinnea el avatar de ' +
      'TODOS los usuarios existentes. Nota: «forgemark» es un token derivado que NO contiene ' +
      'la palabra cubeforge, así que ningún grep del nombre puede encontrarlo nunca.',
  },
  {
    pattern: /legacy[a-zA-Z]*\s*:\s*\[[^\]]*cube[ _.-]?forge[^\]]*\]/i,
    why:
      'Etiquetas heredadas que el LECTOR acepta (doble lectura, PR-4): temas, backups de ' +
      'colección y exports de solves. El escritor graba siempre el tag nuevo, pero el lector ' +
      'debe reconocer el antiguo o los ficheros que el usuario ya descargó dejan de abrirse. ' +
      'NO se pueden borrar nunca: el fichero que las lleva está en el disco de alguien. ' +
      'Guardado también en la auditoría (§14.6.4) y probado en src/lib/exportTag.test.ts.',
  },
];

/**
 * Legacy strings still in the artifact, each with the PR that removes it.
 * Self-expiring: if the entry is no longer found in the bundle, the test fails.
 *
 * PR-2 (la copy visible suelta) ya aterrizó, así que sus cinco entradas se
 * borraron de aquí: el test falló por las cinco en el mismo instante en que
 * dejaron de estar en el bundle, y eso es lo que forzó esta limpieza en vez de
 * dejar la lista pudriéndose.
 *
 * PR-4 (los contratos con ficheros que el usuario ya tiene) también aterrizó: sus
 * dos entradas se borraron de aquí, porque la lectura doble deja las etiquetas
 * antiguas en el bundle PARA SIEMPRE. Esas ya no son residuo pendiente sino
 * contexto congelado (arriba), que es la clasificación honesta: no caducan, se
 * quedan a propósito. Las que quedan son solo nombres internos (PR-5).
 */
const PENDING: { id: string; pattern: RegExp; pr: string; why: string }[] = [
  {
    id: 'console-diagnostics',
    pattern: /%c\[cube[ _.-]?forge\]/i,
    pr: 'PR-5',
    why: 'logs de diagnóstico en consola (dataIntegrity + widgets debug)',
  },
  {
    id: 'i18n-format-keys',
    pattern: /formatNameCubeforge(Csv|Json)/,
    pr: 'PR-5 (opcional)',
    why: 'CLAVES de i18n con la grafía antigua: renombrarlas exige tocar DataSection.tsx + tests',
  },
];

function bundleText(): string {
  const assets = join(DIST, 'assets');
  const files = readdirSync(assets).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  const shell = ['index.html', 'manifest.webmanifest'].filter((f) => existsSync(join(DIST, f)));
  return [...shell.map((f) => join(DIST, f)), ...files.map((f) => join(assets, f))]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

/** Candidate residue windows around every legacy token, deduplicated. */
const IS_WORD_CHAR = /[A-Za-z0-9:._-]/;

/**
 * Window around a mention, SNAPPED OUTWARD to word boundaries: a window that cuts
 * a word in half would turn `cubeforge:open-logs` into a fake bare `cubeforge`
 * and report a false positive.
 */
function residues(text: string): string[] {
  const windows = new Set<string>();
  for (const match of text.matchAll(LEGACY_TOKEN_GLOBAL)) {
    const at = match.index ?? 0;
    let start = Math.max(0, at - 55);
    while (start > 0 && IS_WORD_CHAR.test(text[start])) start--;
    let end = Math.min(text.length, at + 65);
    while (end < text.length && IS_WORD_CHAR.test(text[end])) end++;
    windows.add(text.slice(start, end).replace(/\s+/g, ' '));
  }
  return [...windows];
}

/** La «palabra» completa (identificador) que contiene la mención, con sus guiones. */
function wordAt(text: string, index: number): string {
  let start = index;
  while (start > 0 && IS_WORD_CHAR.test(text[start - 1])) start--;
  let end = index;
  while (end < text.length && IS_WORD_CHAR.test(text[end])) end++;
  return text.slice(start, end);
}

/**
 * A window is clean only when the whole window matches a declared PENDING entry
 * or a frozen context, OR every legacy mention in it is a frozen name with a
 * suffix. A BARE mention (copy or file discriminator) must be declared.
 */
function isAllowed(window: string): boolean {
  if (PENDING.some((entry) => entry.pattern.test(window))) return true;
  if (FROZEN_CONTEXT.some((entry) => entry.pattern.test(window))) return true;
  const mentions = [...window.matchAll(LEGACY_TOKEN_GLOBAL)];
  if (mentions.length === 0) return false;
  return mentions.every((match) => {
    const word = wordAt(window, match.index ?? 0);
    return !BARE_WORD.test(word) && FROZEN_WORD.some((re) => re.test(word));
  });
}

describe.skipIf(!hasDist)('artifact residue — el bundle compilado', () => {
  it('no contiene copy heredada sin clasificar', () => {
    const offenders = residues(bundleText()).filter((window) => !isAllowed(window));
    expect(
      offenders.length,
      'Aparecieron textos heredados en el bundle que nadie ha clasificado.\n' +
        '· copy visible → PR-2\n' +
        '· dentro de un fichero exportado → PR-4 (doble lectura)\n' +
        '· nombre interno congelado → añadirlo a FROZEN_WORD / FROZEN_CONTEXT con su justificación\n\n' +
        offenders.map((window, i) => `[${i}] …${window}…`).join('\n'),
    ).toBe(0);
  });

  it('la lista de pendientes sigue siendo real (cada entrada caduca sola)', () => {
    const text = bundleText();
    const stale = PENDING.filter((entry) => !entry.pattern.test(text)).map(
      (entry) => `${entry.id} (${entry.pr}: ${entry.why})`,
    );
    expect(
      stale,
      'Estas entradas ya no existen en el bundle: bórralas de PENDING (el PR que las eliminó ya llegó).',
    ).toEqual([]);
  });

  it('el manifest y el shell compilados ya usan la marca nueva', () => {
    const manifest = readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8');
    expect(manifest).toContain('"name":"Cubalyze"');
    expect(manifest).toContain('"short_name":"Cubalyze"');
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>Cubalyze/);
    expect(html).not.toMatch(/cube[ _.-]?forge/i);
  });
});
