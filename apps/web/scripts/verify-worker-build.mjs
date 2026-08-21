#!/usr/bin/env node
/**
 * Post-build guard for the SQLite dedicated worker (packages/database).
 *
 * The app boots its database through `new Worker(...)` in client.ts.
 * sqlite-wasm's OPFS persistence is DEDICATED-worker only (SharedWorker
 * silently downgrades to volatile memory), so the bundle must (a) never
 * construct a SharedWorker for the DB, (b) keep the init timeout guard, and
 * (c) keep the storage-tier fallbacks (opfs → opfs-sahpool → memory+snapshot)
 * that keep data on disk even without cross-origin isolation.
 *
 * Bundlers can silently drop/mangle this wiring without any error, which
 * is exactly how the app once shipped broken and only surfaced in prod.
 *
 * Invariants checked:
 *   1. A chunk must construct the dedicated worker (the DB worker entry).
 *   2. That client chunk must NOT construct a SharedWorker.
 *   2b. It must keep the 'Database worker init timed out' timeout guard.
 *   3. The referenced worker chunk must exist.
 *   4. It must be OUR DB worker ('_migrations' marker).
 *   5. It must keep the opfs-sahpool VFS fallback (OpfsSAHPoolDb).
 *   6. It must keep the memory+IndexedDB snapshot tier ('memory-snapshot').
 *      (sqlite-wasm's internal sqlite3-worker1-*.js chunk is excluded — it
 *      is constructed the same way but is not our DB worker.)
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

// 1. Find the chunk that boots the database DEDICATED worker. Minified
//    output looks like:  new Worker(new URL(`/assets/worker-XXX.js`,``+import.meta.url)
const workerUrlRef = /new Worker\(new URL\([`'"](\/assets\/[^`'"]+\.js)[`'"]/;

const hits = [];
for (const f of files) {
  const code = readFileSync(join(assetsDir, f), 'utf8');
  const m = code.match(workerUrlRef);
  if (m) hits.push({ clientFile: f, workerFile: m[1].slice('/assets/'.length) });
}

// sqlite-wasm ships its own internal worker (sqlite3-worker1-*.js) which is
// ALSO constructed via new Worker(new URL(...)). It is not ours: it has no
// `_migrations` marker and never needs the storage-tier guards. Filter it out
// so the invariants below only apply to the REAL database worker.
const isInternalSqliteWorker = (name) => /sqlite3-worker1-/.test(name);

const dbHits = hits.filter((h) => !isInternalSqliteWorker(h.workerFile));
const internalHits = hits.filter((h) => isInternalSqliteWorker(h.workerFile));

if (hits.length === 0) {
  fail('no chunk constructs `new Worker(...)` — the DB worker wiring was removed, renamed, or the URL format changed.');
} else {
  for (const { clientFile, workerFile } of internalHits) {
    console.log(`  (skip) ${clientFile} \u2192 ${workerFile} is sqlite-wasm's internal worker, not the DB worker.`);
  }
  for (const { clientFile, workerFile } of dbHits) {
    console.log(`  \u2713 ${clientFile} \u2192 dedicated Worker ${workerFile}`);

    // 2. The client must NO LONGER boot a SharedWorker (sqlite-wasm OPFS is
    //    dedicated-only; a SharedWorker silently downgrades to memory).
    const clientCode = readFileSync(join(assetsDir, clientFile), 'utf8');
    if (clientCode.includes('new SharedWorker(')) {
      fail(`${clientFile} still constructs a SharedWorker — the DB layer must use a dedicated worker only (OPFS is not supported in SharedWorker).`);
    }

    // 2b. The init timeout guard must still exist.
    if (!clientCode.includes('Database worker init timed out')) {
      fail(`${clientFile} lost the 'Database worker init timed out' timeout guard.`);
    }

    // 3. Worker chunk must exist.
    let workerCode;
    try {
      workerCode = readFileSync(join(assetsDir, workerFile), 'utf8');
    } catch {
      fail(`worker chunk ${workerFile} (referenced by ${clientFile}) does not exist in ${assetsDir}.`);
      continue;
    }

    // 4. Sanity: make sure the URL points at OUR worker, not a lookalike chunk.
    if (!workerCode.includes('_migrations')) {
      fail(`${workerFile} is not our DB worker (missing '_migrations') — the Worker URL may point at the wrong chunk.`);
    }

    // 5. The storage-tier fallback must still exist: opfs-sahpool is the
    //    no-COOP/COEP persistence path that fixes browsers without COI.
    if (!workerCode.includes('OpfsSAHPoolDb')) {
      fail(`${workerFile} lost the opfs-sahpool VFS fallback (OpfsSAHPoolDb) — browsers without cross-origin isolation would silently lose data.`);
    }

    // 6. The memory+snapshot tier (IndexedDB) must still exist.
    if (!workerCode.includes('memory-snapshot')) {
      fail(`${workerFile} lost the memory+IndexedDB snapshot tier — no persistence left when OPFS is entirely unavailable.`);
    }
  }
}

if (failed) {
  console.error('\n[verify-worker-build] FAILED \u2014 the database persistence wiring regressed. Dedicated worker + OPFS tiers are required.');
  process.exit(1);
}
console.log(`\n[verify-worker-build] OK \u2014 dedicated worker + OPFS tiers present (${dbHits.length} client chunk(s)).`);
