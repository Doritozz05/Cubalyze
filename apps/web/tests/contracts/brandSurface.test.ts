/**
 * Brand surface guard — Cubeforge → Cubalyze.
 *
 * Pins the contract that every USER-FACING string carries the new brand and no
 * trace of the old one. It scans **values**, never keys: locale keys are allowed
 * to keep the legacy spelling (`formatNameCubeforge*`) because renaming a key is
 * a code change in `DataSection.tsx`, not a text change. That exception is
 * asserted explicitly below so it cannot be "tidied up" by accident.
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
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Tests run from the repo root (`pnpm test`) or from `apps/web` when the package
// is invoked directly (`pnpm --filter web exec vitest`). Same fallback the
// recon-dataset gate uses.
const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/** Any spelling of the legacy wordmark: CubeForge, cubeforge, cube-forge, cube forge. */
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
      'Un texto visible (valor de i18n) sigue diciendo la marca antigua. ' +
        'Renombrar el VALOR es seguro; la CLAVE formatNameCubeforge* sí se queda (§15 PR-1).',
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

  it.each(LOCALES)('%s: la excepción declarada de las claves de formato sigue intacta', (file) => {
    // Renaming these keys requires touching DataSection.tsx + the import/format
    // tests in the same commit — that is PR-2/PR-5 work, not a text edit. Looked
    // up by name (not by a fixed path) so a reorganisation of the JSON tree does
    // not turn this guard into a false alarm.
    const paths = collectValues(JSON.parse(read(file))).map((entry) => entry.path);
    for (const key of ['formatNameCubeforgeCsv', 'formatNameCubeforgeJson']) {
      expect(
        paths.some((path) => path.split('.').includes(key)),
        `desapareció la clave ${key}: renombrarla obliga a tocar código (DataSection.tsx) en el mismo commit`,
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
 * Ámbito: SOLO texto visible. Los identificadores de código son otra cosa — el
 * scope de los paquetes (`@cubalyze/*`) y los nombres de fichero van en
 * minúsculas por convención y no son marca, así que este test no los mira.
 *
 * Única excepción admitida: un nombre de host, en minúsculas por convención
 * (`cubalyze.app`). Cualquier otra grafía debe ser una decisión explícita, no un
 * descuido.
 */
const CANONICAL_BRAND = 'Cubalyze';

/** La marca en CUALQUIER grafía, para poder rechazar las que no son la canónica. */
function nonCanonicalMentions(text: string): string[] {
  const offenders: string[] = [];
  // Regex local (no compartida) para no depender nunca de `lastIndex`.
  for (const match of text.matchAll(/cub[ _.-]?alyze/gi)) {
    const form = match[0];
    if (form === CANONICAL_BRAND) continue;
    const after = (match.index ?? 0) + form.length;
    // `cubalyze.app` → nombre de host, la minúscula es correcta.
    if (/^\.[a-z]{2,}/.test(text.slice(after, after + 12))) continue;
    offenders.push(form);
  }
  return offenders;
}

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

  it('shells HTML y manifest: exactamente `Cubalyze`', () => {
    const surfaces = [
      'apps/web/index.html',
      'apps/desktop/index.html',
      'apps/web/vite.config.ts',
    ] as const;
    const offenders = surfaces.flatMap((file) =>
      nonCanonicalMentions(read(file)).map((form) => `${file} → «${form}»`),
    );
    expect(offenders).toEqual([]);
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
