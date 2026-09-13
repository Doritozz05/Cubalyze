#!/usr/bin/env node
/**
 * Generates apps/web/public/version.json — the single server-side source of
 * truth for "which build is live".
 *
 * The app polls this file at runtime (boot/appUpdate.ts) and compares its
 * `sha` against the __BUILD_SHA__ baked into the running bundle. Same SHA
 * logic as vite.config.ts#getBuildSha so both sides always agree:
 * VERCEL_GIT_COMMIT_SHA when built on Vercel, else the local git HEAD.
 *
 * Must run BEFORE `vite build` (wired into the `build` script) so the file
 * is copied to dist/ as a static asset.
 *
 * Usage: node scripts/gen-version-json.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, '..');

function getBuildSha() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const pkg = JSON.parse(readFileSync(resolve(webDir, 'package.json'), 'utf8'));

const payload = {
  version: pkg.version,
  sha: getBuildSha(),
  builtAt: new Date().toISOString(),
};

const outPath = resolve(webDir, 'public', 'version.json');
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[gen-version-json] ${outPath} → v${payload.version} · ${payload.sha}`);
