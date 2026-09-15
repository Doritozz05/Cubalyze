/**
 * Deploy header contract — Vercel must never hand the browser a long-lived cache
 * entry for a URL that can 404.
 *
 * Why this file exists (production incident, 2026-09-15):
 *   `/assets/time-distribution-<hash>.js` got exactly ONE 404 — the few seconds of
 *   a deploy window in which the new `sw.js` was already being served while the new
 *   chunk was not yet resolvable in that edge. Vercel applied our own path-based
 *   rule (`/assets/(.*)` → `immutable, max-age=31536000`) to that ERROR response,
 *   so the browser stored a 404 with a one-year, immutable lifetime.
 *
 *   Workbox precaches hashed Vite assets with `cache: 'default'`: the filename hash
 *   is already the cache key, so those entries carry no `revision` and the precache
 *   fetch does NOT bypass the HTTP cache (`workbox-precaching` picks `reload` only
 *   for revisioned entries — see the deployed runtime, `revision ? "reload" :
 *   "default"`). The service worker therefore kept asking for a URL the browser had
 *   cached as a permanent 404, and `precacheAndRoute` rejects the WHOLE install on
 *   a single bad response. Result: the update could never be applied — every
 *   reload, `Ctrl+Shift+R` included, repeated the same error with the same hash,
 *   because a hard reload does not evict what the worker's own fetch reads back.
 *
 *   The rule was path-based, i.e. blind to the status code, so no `has`/`missing`
 *   condition can fix it: every URL under `/assets/` inherits the header whether
 *   the file exists or not. Revalidation is the only safe configuration — the
 *   content hash in the filename makes it a cheap 304, and the service worker
 *   precache is what actually serves repeat visits.
 *
 * It fails on purpose if somebody reintroduces long-lived asset caching, and also
 * pins the SPA rewrite: a missing asset must never be answered with `index.html`
 * (a 200 with HTML where the worker expects a module is worse than a 404).
 *
 * See docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md §15, «Incidente de producción: el 404 que se
 * cacheó un año».
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercel: { rewrites?: { source: string; destination: string }[]; headers?: HeaderRule[] } =
  JSON.parse(read('vercel.json'));

const HEADER_RULES = vercel.headers ?? [];

const cacheControlFor = (source: string): string | undefined =>
  HEADER_RULES.find((rule) => rule.source === source)?.headers.find(
    (header) => header.key.toLowerCase() === 'cache-control',
  )?.value;

/** The longest `max-age` in a Cache-Control value, in seconds (0 when absent). */
const maxAgeOf = (value: string): number => {
  const match = /max-age=(\d+)/.exec(value);
  return match ? Number(match[1]) : 0;
};

describe('deploy headers — nada que pueda fallar se cachea a largo plazo', () => {
  it.each(['/sw.js', '/index.html', '/version.json'])(
    '%s se sirve con max-age=0, must-revalidate',
    (source) => {
      const value = cacheControlFor(source);
      expect(
        value,
        `${source} perdió su regla de revalidación. Si el shell o el worker se cachean, ` +
          'un despliegue deja de ser visible: el usuario sigue abriendo la versión vieja ' +
          '(y con ella la marca vieja) aunque producción ya esté actualizada.',
      ).toBe('public, max-age=0, must-revalidate');
    },
  );

  it('ninguna regla concede caché larga o inmutable a una ruta que puede dar 404', () => {
    for (const rule of HEADER_RULES) {
      const value = rule.headers.find(
        (header) => header.key.toLowerCase() === 'cache-control',
      )?.value;
      if (!value) continue;

      expect(
        value.includes('immutable'),
        `«${rule.source}» volvió a marcar respuestas como \`immutable\`.\n` +
          'Esta regla es por RUTA, no por estado: también se aplica a los 404 de una ' +
          'ventana de despliegue. Un único 404 inmutable deja al service worker sin poder ' +
          'precachear ese chunk PARA SIEMPRE (los assets con hash se piden con ' +
          '`cache: "default"`, así que la caché HTTP del navegador no se bypassa) y ' +
          '`precacheAndRoute` aborta la instalación completa: el cliente se queda clavado ' +
          'en la versión anterior sin forma de actualizarse. Ver el comentario de cabecera.',
      ).toBe(false);

      expect(
        maxAgeOf(value) <= 60,
        `«${rule.source}» cachea ${maxAgeOf(value)}s. Cualquier valor alto convierte un 404 ` +
          'transitorio de un despliegue en una URL envenenada mientras dure el TTL, porque el ' +
          'error hereda las mismas cabeceras que el acierto. Los nombres con hash ya permiten ' +
          'revalidar barato (304); el precache del service worker es lo que sirve las visitas ' +
          'repetidas.',
      ).toBe(true);
    }
  });

  it('el rewrite del SPA sigue excluyendo las rutas con punto (un asset ausente no es index.html)', () => {
    const rewrite = vercel.rewrites?.[0];
    expect(rewrite?.source, 'desapareció el rewrite del SPA').toBeDefined();
    expect(
      rewrite!.source.includes('.*\\..*'),
      'El rewrite dejó de excluir los caminos con punto, así que un asset inexistente ' +
        '(/assets/x.js) se respondería con index.html y un 200: el service worker guardaría ' +
        'HTML donde espera un módulo y fallaría en silencio, en vez de dar un 404 detectable.',
    ).toBe(true);
  });
});
