#!/usr/bin/env node
/**
 * Post-build guard for the SQLite SharedWorker (packages/database).
 *
 * The app boots its database through `new SharedWorker(...)` in
 * packages/database/src/client.ts. The worker chunk MUST wire its per-tab
 * connection port (`self.onconnect` → `Comlink.expose(DBWorker, port)`) or
 * the main thread's `init()` request is never answered and the WHOLE app
 * hangs on skeletons with an empty console — which shipped exactly once and
 * only surfaced in production, because bundlers can silently drop or mangle
 * worker wiring without any error (tree-shaking, minifier renames, comlink's
 * `expose` not handling SharedWorker out of the box...).
 *
 * This script scans the freshly built chunks for the wiring invariants and
 * fails the build with a clear message if any of them regresses:
 *
 *   1. A chunk must construct the SharedWorker (the DB worker entry).
 *   2. That client chunk must still contain the handshake-timeout fallback
 *      (client.ts) — a silent worker hang must degrade to the dedicated
 *      worker instead of freezing the app.
 *   3. The referenced worker chunk must exist.
 *   4. The worker chunk must contain the `onconnect` wiring.
 *   5. The worker chunk must access `event.ports[0]` (the per-tab port).
 *   6. The worker chunk must be OUR DB worker (`_migrations` marker), not
 *      some other chunk the URL happened to point at.
 *
 * Usage: node scripts/verify-worker-build.mjs [distDir]   (default: ./dist)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const assetsDir = join(distDir, 'assets');

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`  \u2717 ${msg}`);
};

console.log(`[verify-worker-build] scanning ${assetsDir}`);

let files;
try {
  files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
} catch (err) {
  console.error(`[verify-worker-build] FAILED — cannot read ${assetsDir}: ${err.message}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`[verify-worker-build] FAILED — no JS chunks found in ${assetsDir}. Run 'vite build' first.`);
  process.exit(1);
}

// 1. Find every chunk that constructs the SharedWorker and the file it points to.
//    Minified output looks like:  new SharedWorker(new URL(`/assets/worker-XXX.js`,``+import.meta.url)
const workerUrlRef = /new SharedWorker\(new URL\([`'"](\/assets\/[^`'"]+\.js)[`'"]/;

const hits = [];
for (const f of files) {
  const code = readFileSync(join(assetsDir, f), 'utf8');
  const m = code.match(workerUrlRef);
  if (m) hits.push({ clientFile: f, workerFile: m[1].slice('/assets/'.length) });
}

if (hits.length === 0) {
  fail('no chunk constructs `new SharedWorker(...)` — the DB worker wiring was removed, renamed, or the URL format changed.');
} else {
  for (const { clientFile, workerFile } of hits) {
    console.log(`  \u2713 ${clientFile} \u2192 SharedWorker ${workerFile}`);

    // 2. Client-side timeout fallback must still exist.
    const clientCode = readFileSync(join(assetsDir, clientFile), 'utf8');
    if (!clientCode.includes('SharedWorker init timed out')) {
      fail(`${clientFile} lost the 'SharedWorker init timed out' fallback (client.ts timeout guard was removed).`);
    }

    // 3. Worker chunk must exist.
    let workerCode;
    try {
      workerCode = readFileSync(join(assetsDir, workerFile), 'utf8');
    } catch {
      fail(`worker chunk ${workerFile} (referenced by ${clientFile}) does not exist in ${assetsDir}.`);
      continue;
    }

    // 4. The onconnect wiring — the core invariant that was missing in prod.
    if (!workerCode.includes('onconnect')) {
      fail(`${workerFile} has NO 'onconnect' — the SharedWorker will never answer init() and the app will hang on skeletons. Fix packages/database/src/worker.ts.`);
    }

    // 5. The per-tab connection port must be unwired (comlink never auto-wires it).
    if (!workerCode.includes('ports[0]')) {
      fail(`${workerFile} never accesses 'event.ports[0]' — the per-tab port is not exposed.`);
    }

    // 6. Sanity: make sure the URL points at OUR worker, not a lookalike chunk.
    if (!workerCode.includes('_migrations')) {
      fail(`${workerFile} is not our DB worker (missing '_migrations') — the SharedWorker URL may point at the wrong chunk.`);
    }
  }
}

if (failed) {
  console.error('\n[verify-worker-build] FAILED \u2014 the database SharedWorker wiring regressed. Fix packages/database/src/worker.ts (self.onconnect \u2192 Comlink.expose(DBWorker, port)) and rebuild.');
  process.exit(1);
}
console.log(`\n[verify-worker-build] OK \u2014 SharedWorker wiring present (${hits.length} client chunk(s)).`);
