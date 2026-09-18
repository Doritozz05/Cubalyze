/**
 * Brand surface guard — del wordmark antiguo a Cubalyze.
 *
 * Pins the contract that every USER-FACING string carries the new brand and no
 * trace of the old one. It scans **values**, never keys: renaming a key is a code
 * change, not a text change, so keys are judged elsewhere (the metadata guard in
 * docsBrand.test.ts, and the dynamic-lookup guard in src/i18n/index.test.ts).
 *
 * PR-1 deliberately left the legacy `formatName*` KEYS in place and pinned that
 * decision here. PR-5 renamed them — together with `DataSection.tsx` and the tests
 * — and this file now asserts the keys it looks up actually resolve, which is the
 * risk that made renaming them unsafe in the first place.
 *
 * Why a test instead of a grep:
 *   • it keeps holding after the package scope is renamed (PR-3) and after the
 *     docs are frozen, when a grep for the old name is expected to hit again;
 *   • it fails in CI the moment somebody adds a new visible string with the old
 *     brand — the one class of regression no other test can see.
 *
 * The three SEO files (`public/robots.txt`, `public/sitemap.xml`,
 * `public/llms.txt`) are deliberately NOT renamed yet: they carry absolute URLs
 * from the old domain and must land atomically with the domain cutover. They are
 * listed as SELF-EXPIRING exceptions — each must still contain a legacy URL, so
 * when the cutover renames them this test fails and forces the list to be
 * cleaned instead of silently going stale.
 *
 * See docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md (§15, PR-1).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Tests run from the repo root (`pnpm test`) or from `apps/web` when the package
// is invoked directly (`pnpm --filter web exec vitest`). Same fallback the
// recon-dataset gate uses.
const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/** Cualquier grafía del wordmark antiguo: las dos capitalizaciones y, entre ellas,
 *  un separador opcional (espacio, `-`, `.` o `_`). */
const LEGACY = /cube[ _.-]?forge/i;
/** Any spelling of the new wordmark. */
const BRAND = /cubalyze/i;

const LOCALES = [
  'apps/web/src/i18n/locales/en.json',
  'apps/web/src/i18n/locales/es.json',
] as const;

/** Every string leaf of a locale file, wherever it sits in the tree. */
function collectValues(node: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof node === 'string') return [{ path: path.join('.'), value: node }];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
    collectValues(child, [...path, key]),
  );
}

describe('brand surface — visible text values', () => {
  it.each(LOCALES)('%s: ningún valor visible conserva la marca antigua', (file) => {
    const values = collectValues(JSON.parse(read(file)));
    const offenders = values.filter((entry) => LEGACY.test(entry.value));
    expect(
      offenders.map((entry) => `${entry.path} = ${entry.value}`),
      'Un texto visible (valor de i18n) sigue diciendo la marca antigua. '
        + 'Renombrar el VALOR es seguro; las CLAVES también van con la marca nueva (§15 PR-5).',
    ).toEqual([]);
  });

  it.each(LOCALES)('%s: los valores anclados llevan la marca nueva', (file) => {
    const locale = JSON.parse(read(file)) as {
      common: Record<string, string>;
      meta: Record<string, string>;
    };
    // These four drive the tab title, the PWA/SEO copy and the update toast.
    for (const value of [
      locale.common.appName,
      locale.common.appTitle,
      locale.common.updateAvailableBody,
      locale.meta.brand,
    ]) {
      expect(BRAND.test(value), `valor sin la marca nueva: ${value}`).toBe(true);
    }
  });

  it.each(LOCALES)('%s: las claves de formato llevan ya la marca nueva', (file) => {
    // Replaces PR-1's "the legacy keys are still here" exception, which expired the
    // moment PR-5 renamed them. Looked up by name (not by a fixed path) so a
    // reorganisation of the JSON tree does not turn this guard into a false alarm.
    const paths = collectValues(JSON.parse(read(file))).map((entry) => entry.path);
    for (const key of ['formatNameCubalyzeCsv', 'formatNameCubalyzeJson']) {
      expect(
        paths.some((path) => path.split('.').includes(key)),
        `falta la clave ${key}: DataSection.tsx la busca y la etiqueta saldría en crudo`,
      ).toBe(true);
    }
  });
});

describe('brand surface — HTML shells', () => {
  const SHELLS = ['apps/web/index.html', 'apps/desktop/index.html'] as const;

  it.each(SHELLS)('%s: sin marca antigua y con la nueva', (file) => {
    const html = read(file);
    expect(html).not.toMatch(LEGACY);
    expect(html).toMatch(BRAND);
  });

  it('apps/web/index.html: título y OpenGraph usan la marca nueva', () => {
    const html = read('apps/web/index.html');
    expect(html).toMatch(/<title>[^<]*Cubalyze/);
    expect(html).toMatch(/property="og:title"\s+content="Cubalyze/i);
    expect(html).toMatch(/name="description"[\s\S]{0,200}?Cubalyze/);
  });

  it('apps/web/index.html: el título estático es EXACTAMENTE el appTitle de EN', () => {
    // Dos fuentes del mismo texto: la base SEO del shell y el `appTitle` que i18n
    // escribe en `document.title` al init. Si divergen (p. ej. alguien capitaliza
    // una y no la otra) el título parpadea al cargar y los buscadores indexan una
    // grafía distinta de la de la app.
    const html = read('apps/web/index.html');
    const staticTitle = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    const en = JSON.parse(read('apps/web/src/i18n/locales/en.json')) as {
      common: Record<string, string>;
    };
    expect(staticTitle, 'sin <title> en el shell').toBeTruthy();
    expect(staticTitle).toBe(en.common.appTitle);
  });

  it('apps/desktop/index.html: el título de la ventana usa la marca nueva', () => {
    expect(read('apps/desktop/index.html')).toMatch(/<title>Cubalyze<\/title>/);
  });
});

describe('brand surface — escritorio (lo que ve el sistema operativo)', () => {
  // Lo que aparece en el menú Inicio, en "Aplicaciones instaladas" y en la barra
  // de tareas. Es tanta superficie de marca como el manifest de la PWA y se
  // escapó de PR-1 porque vive en la configuración de Tauri, no en la web.
  it('tauri.conf.json: productName y el título de la ventana son la marca nueva', () => {
    const conf = read('apps/desktop/src-tauri/tauri.conf.json');
    expect(conf).toMatch(/"productName":\s*"Cubalyze"/);
    expect(conf).toMatch(/"title":\s*"Cubalyze"/);
    expect(conf).not.toMatch(/"productName":\s*"CubeForge"/);
    expect(conf).not.toMatch(/"title":\s*"CubeForge"/);
    // El identificador NO es marca: es el contrato con el directorio de datos de
    // cada dispositivo (lo vigilan los tests de storageContract).
    expect(conf).toMatch(/"identifier":\s*"com\.cubeforge\.desktop"/);
  });
});

describe('brand surface — PWA manifest', () => {
  it('vite.config.ts: name y short_name (lo que se ve bajo el icono instalado)', () => {
    const config = read('apps/web/vite.config.ts');
    expect(config).toMatch(/name:\s*'Cubalyze'/);
    expect(config).toMatch(/short_name:\s*'Cubalyze'/);
    expect(config).not.toMatch(/name:\s*'CubeForge'/);
    expect(config).not.toMatch(/short_name:\s*'CubeForge'/);
  });
});

/**
 * Una marca, una grafía: el wordmark visible es SIEMPRE `Cubalyze`.
 *
 * Ni `cubalyze`, ni `CUBALYZE`, ni `Cub-Alyze`, ni `Cub Alyze`: ver dos formas del
 * mismo nombre en la misma interfaz se lee como descuido de marca. Un nombre
 * propio no se «lowercasea» porque el sitio donde aparece sea un título.
 *
 * Ámbito: la marca **como palabra**. Los identificadores de código son otra cosa —
 * el scope de los paquetes (`@cubalyze/*`), los nombres de fichero y las claves
 * van en minúsculas por convención y no son marca. Por eso la regla distingue
 * una MENCIÓN de un IDENTIFICADOR (ver `isTechnicalIdentifier`), y no simplemente
 * busca la cadena: buscarla marcaría en falso cada import del monorepo.
 *
 * Dos excepciones, ambas por convención y no por descuido:
 *   · un nombre de host va en minúsculas (`cubalyze.app`);
 *   · un identificador técnico va en minúsculas (`@cubalyze/database`, `cubalyze-config`).
 * Cualquier OTRA grafía debe ser una decisión explícita.
 */
const CANONICAL_BRAND = 'Cubalyze';

/**
 * ¿La mención forma parte de un identificador técnico en vez del wordmark?
 *
 * `@cubalyze/database` · `cubalyze/database` · `cubalyze-config` · `cubalyze_db`
 * · `cubalyze.app` → sí (identificador/host). `cubalyze` suelto o `Cub-Alyze` en
 * prosa → no (es marca mal escrita, y queremos que falle).
 */
function isTechnicalIdentifier(text: string, at: number, form: string): boolean {
  const before = at > 0 ? text[at - 1] : '';
  const after = text.slice(at + form.length, at + form.length + 12);
  // Precedido por `@` o por otro carácter de palabra: parte de un identificador.
  if (before === '@' || /\w/.test(before)) return true;
  // Seguido de `@`: parte local de un email (`cubalyze@gmail.com`). Los emails
  // van en minúsculas por convención (el contacto legal vive en los locales).
  if (after.startsWith('@')) return true;
  // Seguido de `/`, `_`, `-` u otro carácter de palabra (…-config, …/database) →
  // identificador técnico.
  if (/^[\w/-]/.test(after)) return true;
  // Seguido de `.` + dominio: nombre de host (`cubalyze.app`), minúscula correcta.
  // El punto SOLO exime si le siguen letras: así «Bienvenido a cubalyze.» (marca
  // en minúscula al final de una frase) sigue fallando, como debe.
  return /^\.(?:[a-z]{2,})/i.test(after);
}

/**
 * La marca en CUALQUIER grafía, para poder rechazar las que no son la canónica.
 * Devuelve solo las que son menciones de verdad (no identificadores técnicos).
 */
function nonCanonicalMentions(text: string): string[] {
  const offenders: string[] = [];
  // Regex local (no compartida) para no depender nunca de `lastIndex`.
  for (const match of text.matchAll(/cub[ _.-]?alyze/gi)) {
    const form = match[0];
    if (form === CANONICAL_BRAND) continue;
    if (isTechnicalIdentifier(text, match.index ?? 0, form)) continue;
    offenders.push(form);
  }
  return offenders;
}

describe('brand surface — la regla de grafía, probada en sí misma', () => {
  // Probar la REGLA (no solo su aplicación) es lo que impide que una futura
  // «simplificación» la vuelva inservible sin que nadie se entere.
  it('acepta la grafía canónica y los identificadores técnicos', () => {
    for (const ok of [
      'Cubalyze',
      'Bienvenido a Cubalyze',
      'Cubalyze CSV',
      '@cubalyze/database',
      'pnpm --filter @cubalyze/training test',
      'cubalyze.app',
      'cubalyze@gmail.com',
      'cubalyze-config',
      'cubalyze_db',
      'packages/cubalyze-docs',
    ]) {
      expect(nonCanonicalMentions(ok), `debería aceptar: ${ok}`).toEqual([]);
    }
  });

  it('rechaza la marca escrita de otra forma', () => {
    for (const [bad, expected] of [
      ['cubalyze es la app', ['cubalyze']],
      ['CUBALYZE — timer', ['CUBALYZE']],
      ['Cub-Alyze — timer', ['Cub-Alyze']],
      ['Cub Alyze — timer', ['Cub Alyze']],
      ['cub_alyze', ['cub_alyze']],
      ['Cubalyze y cubalyze', ['cubalyze']],
    ] as const) {
      expect(nonCanonicalMentions(bad), `debería rechazar: ${bad}`).toEqual([...expected]);
    }
  });
});

describe('brand surface — una sola grafía visible (Cubalyze)', () => {
  it.each(LOCALES)('%s: toda mención visible es exactamente `Cubalyze`', (file) => {
    const values = collectValues(JSON.parse(read(file)));
    const offenders = values.flatMap((entry) =>
      nonCanonicalMentions(entry.value).map(
        (form) => `${entry.path} → «${form}»  (valor: ${entry.value})`,
      ),
    );
    expect(
      offenders,
      'El texto visible escribe la marca de otra forma que no es `Cubalyze`. La marca se escribe ' +
        'siempre igual; si de verdad hace falta otra grafía (p. ej. un host en minúsculas), ' +
        'declárala aquí en vez de dejarla pasar.',
    ).toEqual([]);
  });

  it('shells, manifest y copy visible hardcodeada: exactamente `Cubalyze`', () => {
    const surfaces = [
      'apps/web/index.html',
      'apps/desktop/index.html',
      'apps/web/vite.config.ts',
      // Copy visible que NO pasa por i18n: el wordmark del sidebar, la vista
      // previa del estudio de temas y los dos mensajes de error de importación.
      'apps/web/src/components/Layout/LeftSidebar.tsx',
      'apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx',
      'apps/web/src/views/Collection/collectionTransfer.ts',
      'apps/web/src/utils/importSolves.ts',
    ] as const;
    const offenders = surfaces.flatMap((file) =>
      nonCanonicalMentions(read(file)).map((form) => `${file} → «${form}»`),
    );
    expect(offenders).toEqual([]);
  });

  it('autoría de los widgets: ni la marca antigua ni una variante de la nueva', () => {
    // Data-driven a propósito: un widget nuevo queda cubierto sin tocar el test.
    const dir = join(REPO_ROOT, 'apps/web/src/widgets/implementations');
    const files = readdirSync(dir)
      .map((name) => join(dir, name, 'definition.ts'))
      .filter((file) => existsSync(file));
    expect(files.length, 'no se encontraron definiciones de widgets').toBeGreaterThanOrEqual(11);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const author = /author:\s*["'`]([^"'`]*)["'`]/.exec(source)?.[1];
      // Un widget puede no declarar autoría; si la declara, es marca visible en
      // el explorador y se escribe igual que el resto.
      if (author === undefined) continue;
      // Ruta relativa y con `/` (el test corre igual en Windows que en CI).
      const where = file.slice(REPO_ROOT.length).replace(/^[\\/]/, '').replace(/\\/g, '/');
      if (LEGACY.test(author)) offenders.push(`${where} → autoría con la marca antigua: «${author}»`);
      for (const form of nonCanonicalMentions(author)) offenders.push(`${where} → «${form}»`);
    }
    expect(
      offenders,
      'La autoría de los widgets se ve en el explorador del dock: tiene que usar la marca nueva, ' +
        'con la única grafía canónica.',
    ).toEqual([]);
  });
});

describe('brand surface — SEO pendiente del cutover de dominio (lista que caduca sola)', () => {
  // While the old domain is live these files legitimately carry it. Each one must
  // STILL carry a legacy URL: when the cutover renames them, this test fails and
  // forces the entry to be removed here instead of lingering as dead weight.
  const PENDING_CUTOVER = [
    'apps/web/public/robots.txt',
    'apps/web/public/sitemap.xml',
    'apps/web/public/llms.txt',
  ] as const;

  it.each(PENDING_CUTOVER)('%s: sigue pendiente del cutover (renombrar ⇒ borrar de esta lista)', (file) => {
    expect(read(file)).toMatch(LEGACY);
  });
});
