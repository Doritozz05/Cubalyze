/**
 * pll-detection-batch.test.ts — PLL detection audit over real WCA solves.
 *
 * Deep-study harness (like cross-study), NOT a CI regression test. Gated
 * behind RUN_PLL_BATCH=1 so the default `vitest run` never executes it
 * (it analyzes thousands of solves and prints a full report).
 *
 *   RUN_PLL_BATCH=1 pnpm --dir packages/analysis-engine exec vitest run \
 *     src/__tests__/pll-detection-batch.test.ts
 *
 * For every 3x3 CFOP solve in apps/web/public/reconstructions/data it runs
 * the production text route (analyzeSolveText, relaxed cross) and compares
 * the STATE-based PLL detection against what the reconstructionist wrote.
 *
 * A solve has a REAL PLL to detect only when the raw transcript contains a
 * PLL/EPLL/AUF-named block of >=5 face moves (the shortest real PLL
 * algorithm is the 9-STM U-perm — the same guard the PhaseSplitter uses).
 * Finishes with no such block are PLL skips / one-look LL (ZBLL, 1LLL,
 * 2GLL, ELL, OLL(CP)+AUF) — there is NO PLL case to detect, so they are
 * reported as context, not as misses.
 *
 * Misses (real written PLL block, no exact detection) are bucketed by the
 * state our detector saw at the PLL boundary:
 *   • no-phase   — no PLL phase emitted by the splitter.
 *   • skipped    — phase emitted but marked skipped (boundary lag: the
 *                  permutation was already solved at OLL completion).
 *   • unknown    — phase present but the pre-state is not a valid PLL
 *                  (misoriented LL piece → OLL/PLL boundary is off, or the
 *                  written "PLL" was actually a ZBLL-style finish).
 */
import { describe, it, expect } from 'vitest';
const ENABLED = process.env.RUN_PLL_BATCH === '1';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CubeState } from '@cubeforge/math-core';
import { getSeedData } from '@cubeforge/algorithm-db';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

// ── Independent ground-truth classifier ────────────────────────────────────
// The 21 canonical PLL LL permutations, derived from the catalog's default
// algorithms (apply the alg to a solved cube, read positions 0-3). This is
// INDEPENDENT of the probe's anchor/relabel/signature machinery.
interface SeedPerm {
  case: string;
  cp: string;
  ep: string;
}

let _seedPerms: SeedPerm[] | null = null;
function pllSeedPerms(): SeedPerm[] {
  if (_seedPerms) return _seedPerms;
  const { cases, algorithms } = getSeedData();
  const byCase = new Map(cases.map((c) => [c.id, c]));
  const out: SeedPerm[] = [];
  for (const a of algorithms) {
    const c = byCase.get(a.caseId);
    if (!c || !/^[A-Z][a-z]?$/.test(c.caseNumber)) continue;
    if (!a.isDefault) continue;
    const cube = new CubeState();
    cube.applySequence(a.moves.join(' '));
    out.push({
      case: c.caseNumber,
      cp: Array.from(cube.cp as any).slice(0, 4).join(''),
      ep: Array.from(cube.ep as any).slice(0, 4).join(''),
    });
  }
  _seedPerms = out;
  return out;
}

// The 24-element rotation group, closed under the 9 base rotations.
let _rotGroup: string[] | null = null;
function rotationGroup(): string[] {
  if (_rotGroup) return _rotGroup;
  const bases = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  const seen = new Set<string>(['']);
  const group: string[] = [''];
  const queue: string[] = [''];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const b of bases) {
      const next = `${cur} ${b}`.trim();
      // Canonicalize by effect: compare piece permutations (rotations of the
      // solved cube are distinct states, so this keys the group exactly).
      const c = new CubeState();
      c.applySequence(next);
      const k = `${Array.from(c.cp as any).join(',')}|${Array.from(c.ep as any).join(',')}`;
      if (!seen.has(k)) {
        seen.add(k);
        group.push(next);
        queue.push(next);
      }
    }
  }
  _rotGroup = group;
  return group;
}

/**
 * Is `state` a standard PLL state (LL complete, oriented, permutation in the
 * 21-PLL catalog) under SOME whole-cube rotation? Returns the case number.
 */
function classifyStandardPll(state: CubeState): string | null {
  const seeds = pllSeedPerms();
  for (const rot of rotationGroup()) {
    const c = state.clone();
    c.applySequence(rot);
    const cp = Array.from(c.cp as any).slice(0, 4);
    const ep = Array.from(c.ep as any).slice(0, 4);
    const co = Array.from(c.co as any).slice(0, 4);
    const eo = Array.from(c.eo as any).slice(0, 4);
    if ((cp as number[]).some((p) => p > 3) || (ep as number[]).some((p) => p > 3)) continue;
    if ((co as number[]).some((o) => o !== 0) || (eo as number[]).some((o) => o !== 0)) continue;
    const cpS = cp.join('');
    const epS = ep.join('');
    for (const s of seeds) {
      if (s.cp === cpS && s.ep === epS) return s.case;
    }
  }
  return null;
}

const FACE_MOVE_RE = /^[URFDLB][2']?$/;
const DATA_DIR = path.resolve(
  __dirname,
  '../../../../apps/web/public/reconstructions/data',
);

interface Rec {
  key: string;
  source?: string;
  solver?: string;
  time: number;
  scramble: string;
  text: string;
  phases: { label: string; moves: string }[];
  recognition?: { inspection?: string };
}

function loadAll(limit: number, stride = 1, offset = 0): Rec[] {
  const out: Rec[] = [];
  let i = 0;
  for (let c = 0; c < 60; c++) {
    if (out.length >= limit) break;
    const f = path.join(DATA_DIR, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).solves ?? []) {
      if (out.length >= limit) break;
      i++;
      if (i <= offset || (i - offset) % stride !== 0) continue;
      if (s.puzzle !== '3x3' || s.method !== 'CFOP') continue;
      if (!s.scramble || !s.text || !Array.isArray(s.phases)) continue;
      out.push(s as Rec);
    }
  }
  return out;
}

/** Face-move count of a raw moves string. */
function faceMoves(moves: string): number {
  let n = 0;
  for (const t of moves.trim().split(/\s+/)) {
    if (t && FACE_MOVE_RE.test(t)) n++;
  }
  return n;
}

/** Labels that name a real PLL / EPLL / AUF block. */
const PLL_BLOCK_RE = /pll|perm|auf/i;
/** Labels naming one-look last-layer finishes (no PLL step exists). */
const ONE_LOOK_LL_RE = /zbll|1lll|2gll|ell\b/i;
/** OLL variants that permute corners (OLL(CP)/OLLCP/COLL) — followed by EPLL or nothing. */
const OLL_CP_RE = /oll\s*\(?\s*cp|ollcp|coll/i;

/** Extract a written case token from a label, e.g. "PLL-Ga" → "Ga", "EPLL-U+" → "U+". */
function writtenCaseFromLabel(label: string): string | undefined {
  const m = label.match(/pll[- ]?([a-zA-Z][a-zA-Z0-9+\-]*)/i);
  return m ? m[1] : undefined;
}

interface Miss {
  key: string;
  source: string;
  time: number;
  rawLastLabel: string;
  rawPllLabel: string;
  rawPllMoves: number;
  writtenCase?: string;
  ourPll: string; // 'exact:Ca' | 'unknown' | 'skipped' | 'none'
  ourOll: string;
  finalSolved: boolean;
  reason: string;
}

interface Report {
  total: number;
  threw: number;
  // Solves WITH a real written PLL block.
  withRealPll: number;
  exactCount: number;
  exactByCase: Record<string, number>;
  // Misses within the withRealPll set.
  missByReason: Record<string, number>;
  missByRawLabel: Record<string, number>;
  misses: Miss[];
  // Solves WITHOUT a real PLL block (context, not misses).
  noPllByKind: Record<string, number>;
  noPllByLastLabel: Record<string, number>;
  // Among no-real-PLL solves, how often did we still emit/skip a PLL phase?
  noPllOurStatus: Record<string, number>;
}

describe('PLL detection audit over real WCA solves', { skip: !ENABLED }, () => {
  it('prints the PLL detection report', { timeout: 1_800_000 }, () => {
    const limit = Number(process.env.PLL_BATCH_LIMIT ?? 'Infinity');
    const stride = Number(process.env.PLL_BATCH_STRIDE ?? '1');
    const offset = Number(process.env.PLL_BATCH_OFFSET ?? '0');
    const records = loadAll(limit, stride, offset);
    console.log(`\n=== dataset: ${records.length} CFOP 3x3 records ===\n`);

    const report: Report = {
      total: 0,
      threw: 0,
      withRealPll: 0,
      exactCount: 0,
      exactByCase: {},
      missByReason: {},
      missByRawLabel: {},
      misses: [],
      noPllByKind: {},
      noPllByLastLabel: {},
      noPllOurStatus: {},
    };

    for (const rec of records) {
      const inspection = rec.recognition?.inspection ?? '';
      let out;
      try {
        out = analyzeSolveText({
          setup: rec.scramble,
          inspection,
          solution: rec.text,
          method: 'CFOP',
          relaxedCross: true,
        });
      } catch {
        report.threw++;
        continue;
      }
      report.total++;
      const { reconstruction } = out;

      const rawPhases = rec.phases.filter((p) => p.moves.trim());
      const last = rawPhases[rawPhases.length - 1];
      const rawLastLabel = last?.label.trim() ?? '';
      const writtenPll = [...rawPhases].reverse().find((p) => PLL_BLOCK_RE.test(p.label));
      const pll = reconstruction.pll;

      // Has a real written PLL algorithm block (>=5 face moves, not skip)?
      const realWrittenPll =
        !!writtenPll &&
        !/skip|solved/i.test(writtenPll.label) &&
        faceMoves(writtenPll.moves) >= 5;

      const ourStatus = !pll
        ? 'none'
        : pll.skipped
          ? 'skipped'
          : pll.detectedCase?.confidence === 'exact'
            ? `exact:${pll.detectedCase.caseNumber}`
            : 'unknown';

      if (!realWrittenPll) {
        // No PLL to detect — context only. Distinguish WHY there is none.
        let kind: string;
        if (!writtenPll) {
          kind = 'no PLL/AUF-named block';
        } else if (/skip|solved/i.test(writtenPll.label)) {
          kind = 'written PLL skip (AUF-only block)';
        } else if (ONE_LOOK_LL_RE.test(rawPhases.map((p) => p.label).join(' '))) {
          kind = 'one-look LL (ZBLL/1LLL/2GLL/ELL)';
        } else if (OLL_CP_RE.test(rawPhases.map((p) => p.label).join(' '))) {
          kind = 'OLL(CP)-style finish (corners solved in OLL)';
        } else {
          kind = 'short trailing block (<5 moves)';
        }
        report.noPllByKind[kind] = (report.noPllByKind[kind] ?? 0) + 1;
        report.noPllByLastLabel[rawLastLabel] =
          (report.noPllByLastLabel[rawLastLabel] ?? 0) + 1;
        report.noPllOurStatus[ourStatus] = (report.noPllOurStatus[ourStatus] ?? 0) + 1;
        continue;
      }

      // ── Real PLL block: coverage ──────────────────────────────────────
      report.withRealPll++;
      if (ourStatus.startsWith('exact:')) {
        report.exactCount++;
        report.exactByCase[ourStatus.slice(6)] =
          (report.exactByCase[ourStatus.slice(6)] ?? 0) + 1;
        continue;
      }

      // ── Miss ──────────────────────────────────────────────────────────
      let reason: string;
      if (!pll) reason = 'no PLL phase emitted';
      else if (pll.skipped) reason = 'PLL phase marked skipped (perm solved at OLL)';
      else {
        // Independent ground-truth: is the pre-PLL state a standard PLL?
        const pllPhase = out.timeline.detectionReport?.phases.find(
          (p) => p.phaseName === 'PLL',
        );
        const preIdx = pllPhase ? pllPhase.startIndex - 1 : -1;
        const snap = preIdx >= 0 ? out.timeline.entries[preIdx]?.state : undefined;
        const preState = snap ? TimelineBuilder.fromSnapshot(snap) : null;
        const stdClass = preState ? classifyStandardPll(preState) : null;
        if (stdClass) {
          reason = `DETECTOR BUG: pre-state IS a standard PLL (${stdClass}) but probe missed`;
        } else {
          reason =
            'pre-state NOT a standard PLL (reconstruction data / non-standard finish) or LL not oriented';
        }
      }

      const writtenCase = writtenPll
        ? writtenCaseFromLabel(writtenPll.label)
        : undefined;

      report.missByReason[reason] = (report.missByReason[reason] ?? 0) + 1;
      report.missByRawLabel[writtenPll?.label ?? rawLastLabel] =
        (report.missByRawLabel[writtenPll?.label ?? rawLastLabel] ?? 0) + 1;
      report.misses.push({
        key: rec.key,
        source: rec.source ?? '?',
        time: rec.time,
        rawLastLabel,
        rawPllLabel: writtenPll?.label ?? '',
        rawPllMoves: writtenPll ? faceMoves(writtenPll.moves) : 0,
        writtenCase,
        ourPll: ourStatus,
        ourOll: reconstruction.oll?.detectedCase?.caseNumber ?? 'none',
        finalSolved: reconstruction.finalSolved,
        reason,
      });
    }

    // ── Print ─────────────────────────────────────────────────────────────
    console.log(`analyzed=${report.total} threw=${report.threw}\n`);
    console.log('── A. PLL coverage — solves with a real written PLL/EPLL block ──');
    console.log(
      `  written-PLL solves : ${report.withRealPll}\n` +
        `  detected exact     : ${report.exactCount} ` +
        `(${(report.exactCount / Math.max(1, report.withRealPll) * 100).toFixed(1)}%)\n`,
    );
    console.log('  Detected PLL cases (exact, by case):');
    for (const [k, v] of Object.entries(report.exactByCase).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(8)} ${v}`);
    }

    console.log('\n── B. Misses (written PLL block, not detected) by reason ──');
    if (Object.keys(report.missByReason).length === 0) {
      console.log('  NONE');
    }
    for (const [k, v] of Object.entries(report.missByReason).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    console.log('\n  Misses by written PLL label:');
    for (const [k, v] of Object.entries(report.missByRawLabel).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }

    console.log('\n── C. No real PLL (context: skips & one-look finishes) ──');
    for (const [k, v] of Object.entries(report.noPllByKind).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    console.log('\n  Their last raw label:');
    for (const [k, v] of Object.entries(report.noPllByLastLabel).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k || '(empty)'}`);
    }
    console.log('\n  Our detector status on those solves (should be none/skipped):');
    for (const [k, v] of Object.entries(report.noPllOurStatus).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }

    // Write the full miss list for detailed inspection.
    const outFile = path.join(__dirname, 'out-pll-misses.json');
    fs.writeFileSync(
      outFile,
      JSON.stringify({ report, misses: report.misses }, null, 2),
    );
    console.log(`\nfull miss list → ${outFile}`);

    expect(report.total).toBeGreaterThan(0);
  });
});
