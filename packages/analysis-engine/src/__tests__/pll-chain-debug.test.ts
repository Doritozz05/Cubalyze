import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CubeState, conjugatePhaseStream, tokenize } from '@cubeforge/math-core';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { createCFOPDetector, recolorState } from '@cubeforge/algorithm-db';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

const DATA_DIR = path.resolve(
  __dirname,
  '../../../../apps/web/public/recon-data/data',
);

function findRecord(key: string) {
  for (let c = 0; c < 60; c++) {
    const f = path.join(DATA_DIR, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).solves ?? []) {
      if (s.key === key) return s;
    }
  }
  return null;
}

function tokenizePhases(solution: string): { label: string; tokens: string[] }[] {
  const phases: { label: string; tokens: string[] }[] = [];
  let current = { label: '', tokens: [] as string[] };
  const flush = () => {
    if (current.tokens.length > 0) phases.push({ ...current });
  };
  for (const line of solution.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const commentIdx = trimmed.indexOf('//');
    const movesPart =
      commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;
    const labelPart = commentIdx >= 0 ? trimmed.slice(commentIdx + 2).trim() : '';
    if (commentIdx >= 0 && movesPart === '') {
      flush();
      current = { label: labelPart, tokens: [] };
    } else if (commentIdx >= 0) {
      flush();
      current = { label: labelPart, tokens: tokenize(movesPart) };
    } else {
      current.tokens = [...current.tokens, ...tokenize(movesPart)];
    }
  }
  flush();
  return phases;
}

describe('recovered pre-PLL verification', () => {
  it('checks recovered[26] vs inverse of conjugated PLL', () => {
    const KEY = process.env.PLL_DEBUG_KEY ?? 'reconz-9589';
    const rec = findRecord(KEY)!;
    if (!rec) throw new Error('record not found: ' + KEY);
    console.log('=== record:', KEY, '| recon:', rec.reconstructor, '===');
    const out = analyzeSolveText({
      setup: rec.scramble,
      inspection: rec.recognition?.inspection ?? '',
      solution: rec.text,
      method: 'CFOP',
      relaxedCross: true,
    });
    const { timeline } = out;
    const entries = timeline.entries as any[];
    const report = timeline.detectionReport!;
    const pll = report.phases.find((p) => p.phaseName === 'PLL')!;
    const pllPre = pll.startIndex - 1;

    // The conjugated PLL moves from the timeline entries.
    const moves: string[] = [];
    for (let i = pll.startIndex; i <= pll.endIndex; i++) {
      const m = entries[i]?.move;
      if (!m) continue;
      moves.push(`${m.face}${m.direction === 2 ? '2' : m.direction === -1 ? "'" : ''}`);
    }
    // Verify R=x'y' for index 26 as well: replayStates[27] vs stored[26].
    {
      // Recompute the raw replay states.
      const setup2 = tokenize(rec.scramble).join(' ');
      const rp = tokenizePhases(rec.text);
      const ffi = rp.findIndex((p) => p.tokens.some((t) => /^[URFDLB]/.test(t)));
      const insp = rp.find((p, i) => i < ffi && p.tokens.length > 0 && p.tokens.every((t) => /^[xyz]/.test(t)));
      const { perPhase } = conjugatePhaseStream([insp?.tokens ?? [], ...rp.filter((p) => p !== insp).map((p) => p.tokens)]);
      const toks = perPhase.slice(1).flat().filter((t) => /^[URFDLBMES][2']?$/.test(t));
      const rep = new CubeState();
      rep.applySequence(setup2);
      const rawStates: string[] = [];
      let fc = 0;
      for (const t of toks) {
        rep.applySequence(t);
        if (/^[URFDLB]/.test(t)) {
          fc++;
          rawStates.push(Array.from(rep.cp as any).join(','));
        }
      }
      const raw26 = rawStates[26];
      const stored26 = Array.from(entries[26].state.cp as any).join(',');
      console.log('raw[26] cp  :', raw26);
      console.log('stored[26]  :', stored26);
      const base = raw26.split(',').map(Number);
      const r26 = new CubeState(base as any, [0,0,0,0,0,0,0,0] as any, [0,1,2,3,4,5,6,7,8,9,10,11] as any, [0,0,0,0,0,0,0,0,0,0,0,0] as any);
      r26.applySequence("x' y'");
      console.log('x\'y\'·raw[26]:', Array.from(r26.cp as any).join(','));
      console.log('match:', Array.from(r26.cp as any).join(',') === stored26);
    }
    // What does the rotation x'y' do to the layers?
    {
      const s = new CubeState();
      s.applySequence("x' y'");
      const j = (a: number[]) => a.join('');
      console.log('x\'y\' corners pos4-7 (D layer):', j((Array.from(s.cp as any) as number[]).slice(4, 8)), 'U layer:', j((Array.from(s.cp as any) as number[]).slice(0, 4)));
      console.log('x\'y\' edges pos4-7:', j((Array.from(s.ep as any) as number[]).slice(4, 8)), 'pos0-3:', j((Array.from(s.ep as any) as number[]).slice(0, 4)), 'pos8-11:', j((Array.from(s.ep as any) as number[]).slice(8, 12)));
    }
    console.log('conj PLL:', moves.join(' '));
    // Side-by-side: entries moves vs my stateTokens face tokens.
    {
      const setup3 = tokenize(rec.scramble).join(' ');
      const rp3 = tokenizePhases(rec.text);
      const ffi3 = rp3.findIndex((p) => p.tokens.some((t) => /^[URFDLB]/.test(t)));
      const insp3 = rp3.find((p, i) => i < ffi3 && p.tokens.length > 0 && p.tokens.every((t) => /^[xyz]/.test(t)));
      const pp = conjugatePhaseStream([insp3?.tokens ?? [], ...rp3.filter((p) => p !== insp3).map((p) => p.tokens)]);
      const toks = pp.perPhase.slice(1).flat().filter((t) => /^[URFDLBMES][2']?$/.test(t));
      const faceToks = toks.filter((t) => /^[URFDLB]/.test(t));
      let diff = -1;
      for (let i = 0; i < Math.min(faceToks.length, entries.length); i++) {
        const m = entries[i]?.move;
        const mv = m ? `${m.face}${m.direction === 2 ? '2' : m.direction === -1 ? "'" : ''}` : '?';      
        if (faceToks[i] !== mv) {
          diff = i;
          console.log('MOVE MISMATCH at entry', i, ':', mv, 'vs stateToken', faceToks[i]);
          break;
        }
      }
      if (diff < 0) console.log('all entry moves match stateTokens face tokens');
    }

    // inverse of the block applied to solved = expected pre-state LL.
    const inv: string[] = [];
    for (const t of [...moves].reverse()) {
      inv.push(t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'");
    }
    const expected = new CubeState();
    expected.applySequence(inv.join(' '));
    console.log('inv(conjPLL) LL cp:', Array.from(expected.cp as any).slice(0, 4).join(''), 'ep:', Array.from(expected.ep as any).slice(0, 4).join(''));

    // The recovered pre-PLL state.
    const stored = new CubeState(
      Array.from(entries[pllPre].state.cp as any) as any,
      Array.from(entries[pllPre].state.co as any) as any,
      Array.from(entries[pllPre].state.ep as any) as any,
      Array.from(entries[pllPre].state.eo as any) as any,
    );
    console.log('stored pre-PLL LL cp:', Array.from(stored.cp as any).slice(4).join(''), 'ep:', Array.from(stored.ep as any).slice(4, 8).join(''));
    console.log('stored pre-PLL U cp :', Array.from(stored.cp as any).slice(0, 4).join(''), 'ep:', Array.from(stored.ep as any).slice(0, 4).join(''));

    // Does the conjugated PLL applied to the stored state solve it?
    const t = stored.clone();
    t.applySequence(moves.join(' '));
    console.log('stored + conjPLL solved:', t.isSolved());
    // With the recovery rotation folded in: stored·(R·conjPLL·R⁻¹)?
    {
      const R = "x' y'";
      const Rinv = 'y x';
      const t2 = stored.clone();
      t2.applySequence(`${R} ${moves.join(' ')} ${Rinv}`);
      console.log('stored + R·conjPLL·R⁻¹ solved:', t2.isSolved());
    }

    // DECISIVE: is the timeline self-consistent (each entry chains by its move)?
    {
      let violations = 0;
      const first = [];
      for (let i = 0; i + 1 < entries.length; i++) {
        const s = new CubeState(
          Array.from(entries[i].state.cp as any) as any,
          Array.from(entries[i].state.co as any) as any,
          Array.from(entries[i].state.ep as any) as any,
          Array.from(entries[i].state.eo as any) as any,
        );
        const m = entries[i + 1]?.move;
        if (!m) continue;
        const mv = `${m.face}${m.direction === 2 ? '2' : m.direction === -1 ? "'" : ''}`;
        s.applySequence(mv);
        const nxt = new CubeState(
          Array.from(entries[i + 1].state.cp as any) as any,
          Array.from(entries[i + 1].state.co as any) as any,
          Array.from(entries[i + 1].state.ep as any) as any,
          Array.from(entries[i + 1].state.eo as any) as any,
        );
        const same =
          JSON.stringify(Array.from(s.cp as any)) === JSON.stringify(Array.from(nxt.cp as any)) &&
          JSON.stringify(Array.from(s.co as any)) === JSON.stringify(Array.from(nxt.co as any)) &&
          JSON.stringify(Array.from(s.ep as any)) === JSON.stringify(Array.from(nxt.ep as any)) &&
          JSON.stringify(Array.from(s.eo as any)) === JSON.stringify(Array.from(nxt.eo as any));
        if (!same) {
          violations++;
          if (first.length < 8) first.push(`entry ${i + 1} (${mv}) does not chain`);
        }
      }
      console.log('timeline self-consistency violations:', violations, '/', entries.length - 1);
      for (const f of first) console.log('  ', f);
    }

    // What PLL case is inv(conjPLL) really? Compare against catalog seeds.
    const det = createCFOPDetector();
    const r = det.detectWith(expected, { probe: 'last-layer-permutation', crossFace: 'D' });
    console.log('inv(conjPLL) as case:', r.queriedSignature, '->', r.entry?.caseNumber ?? 'NULL');
    // F2L completeness (pre-OLL) + OLL orientation (pre-PLL):
    {
      const oll = report.phases.find((p) => p.phaseName === 'OLL')!;
      const preOll = new CubeState(
        Array.from(entries[oll.startIndex - 1].state.cp as any) as any,
        Array.from(entries[oll.startIndex - 1].state.co as any) as any,
        Array.from(entries[oll.startIndex - 1].state.ep as any) as any,
        Array.from(entries[oll.startIndex - 1].state.eo as any) as any,
      );
      const dEpieces = new Set([4, 5, 6, 7, 4, 5, 6, 7, 8, 9, 10, 11]);
      const pocp = Array.from(preOll.cp as any) as number[];
      const poep = Array.from(preOll.ep as any) as number[];
      let f2lOk = true;
      for (let p = 4; p <= 11; p++) if (!dEpieces.has(pocp[p])) f2lOk = false;
      for (let p = 4; p <= 11; p++) if (!dEpieces.has(poep[p])) f2lOk = false;
      // LL oriented at pre-PLL?
      const prePll = new CubeState(
        Array.from(entries[pllPre].state.cp as any) as any,
        Array.from(entries[pllPre].state.co as any) as any,
        Array.from(entries[pllPre].state.ep as any) as any,
        Array.from(entries[pllPre].state.eo as any) as any,
      );
      const llCo = Array.from(prePll.co as any).slice(4, 8).join(',');
      const llEo = Array.from(prePll.eo as any).slice(4, 8).join(',');
      console.log('F2L complete at pre-OLL (D+E pieces in slots):', f2lOk);
      console.log('pre-OLL D+E corners in slots:', pocp.slice(4).map((p) => p >= 4 && p <= 7).join(','));
      console.log('LL orientation at pre-PLL (co 4-7):', llCo, '| (eo 4-7):', llEo);
    }

    // Is the recolored state a rotation of the Ja seed? (brute force)
    {
      const scheme = out.reconstruction.scheme;
      const cf = (out.timeline.detectionReport as any).crossFace ?? 'D';
      const sfs = out.timeline.solverFrameStates;
      const snap = sfs?.[pllPre] ?? entries[pllPre].state;
      const st = TimelineBuilder.fromSnapshot(snap);
      const canon = scheme ? recolorState(st, scheme) : st;
      // Ja seed state
      const ja = new CubeState();
      ja.applySequence("R' U L' U2 R U' R' U2 R L");
      const bases = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
      let matchRaw = 'NONE' as string;
      let matchRec = 'NONE' as string;
      const keyOf = (c: CubeState) =>
        `${Array.from(c.cp as any).join(',')}|${Array.from(c.co as any).join(',')}|${Array.from(c.ep as any).join(',')}|${Array.from(c.eo as any).join(',')}`;
      const jaKey = keyOf(ja);
      const queue = [''];
      const seen = new Set(['']);
      while (queue.length) {
        const cur = queue.shift()!;
        for (const b of bases) {
          const next = `${cur} ${b}`.trim();
          const r = new CubeState();
          r.applySequence(next);
          const k = `${Array.from(r.cp as any).join(',')}|${Array.from(r.ep as any).join(',')}`;
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push(next);
          const r1 = st.clone();
          r1.applySequence(next);
          const r2 = canon.clone();
          r2.applySequence(next);
          if (keyOf(r1) === jaKey && matchRaw === 'NONE') matchRaw = next;
          if (keyOf(r2) === jaKey && matchRec === 'NONE') matchRec = next;
        }
      }
      console.log('Ja seed key match: raw solverFrameState under rot:', matchRaw, '| recolored under rot:', matchRec);
    }

    // Replicate the EXACT production detectLL path (solverFrameStates + recolorState).
    {
      const scheme = out.reconstruction.scheme;
      const cf = (out.timeline.detectionReport as any).crossFace ?? 'D';
      const sfs = out.timeline.solverFrameStates;
      const snap = sfs?.[pllPre] ?? entries[pllPre].state;
      const st = TimelineBuilder.fromSnapshot(snap);
      const canon = scheme ? recolorState(st, scheme) : st;
      const r = det.detectWith(canon, { probe: 'last-layer-permutation', crossFace: cf });
      console.log('PRODUCTION path: crossFace=' + cf, '| scheme=' + JSON.stringify(scheme));
      console.log('  solverFrameStates pre-PLL cp:', Array.from(st.cp as any).join(','));
      console.log('  recolored cp:', Array.from(canon.cp as any).join(','));
      console.log('  ->', r.queriedSignature, r.entry?.caseNumber ?? 'NULL');
      // Bisect: entries state + recolor (skip solverFrameStates)
      {
        const e2 = TimelineBuilder.fromSnapshot(entries[pllPre].state);
        const c2 = scheme ? recolorState(e2, scheme) : e2;
        const r2 = det.detectWith(c2, { probe: 'last-layer-permutation', crossFace: cf });
        console.log('  bisect A (entries + recolor):', r2.queriedSignature, r2.entry?.caseNumber ?? 'NULL');
      }
      // Bisect: solverFrameStates, NO recolor
      {
        const r3 = det.detectWith(st, { probe: 'last-layer-permutation', crossFace: cf });
        console.log('  bisect B (sfs, no recolor):', r3.queriedSignature, r3.entry?.caseNumber ?? 'NULL');
      }
      // Bisect: entries, NO recolor (the known-working probe call)
      {
        const e4 = TimelineBuilder.fromSnapshot(entries[pllPre].state);
        const r4 = det.detectWith(e4, { probe: 'last-layer-permutation', crossFace: cf });
        console.log('  bisect C (entries, no recolor):', r4.queriedSignature, r4.entry?.caseNumber ?? 'NULL');
      }
    }

    // Production reconstruction result:
    {
      console.log('production OLL:', JSON.stringify(out.reconstruction.oll?.detectedCase ?? null));
      console.log('production PLL:', JSON.stringify(out.reconstruction.pll?.detectedCase ?? null));
      {
        // Anchored LL pieces for the working state (entries) with crossFace=B.
        const e = TimelineBuilder.fromSnapshot(entries[pllPre].state);
        e.applySequence('x'); // CROSS_TO_D[B] = x
        console.log('anchored(B) cp[0..3]:', Array.from(e.cp as any).slice(0, 4).join(','));
        console.log('anchored(B) ep[0..3]:', Array.from(e.ep as any).slice(0, 4).join(','));
        console.log('anchored(B) co[0..3]:', Array.from(e.co as any).slice(0, 4).join(','), 'eo[0..3]:', Array.from(e.eo as any).slice(0, 4).join(','));
      }
      const sfsSnap = out.timeline.solverFrameStates?.[pllPre];
      const entSnap = entries[pllPre]?.state;
      console.log('sfs pre-PLL cp  :', sfsSnap ? Array.from((sfsSnap as any).cp as any).join(',') : 'undefined');
      console.log('entries pre-PLL :', entSnap ? Array.from((entSnap as any).cp as any).join(',') : 'undefined');
      // Is sfs a rotation of entries? brute force cp/ep
      if (sfsSnap && entSnap) {
        const a = TimelineBuilder.fromSnapshot(sfsSnap);
        const b = TimelineBuilder.fromSnapshot(entSnap);
        const bases = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
        let found = '';
        const q = [''];
        const seen = new Set(['']);
        while (q.length && !found) {
          const cur = q.shift()!;
          for (const bb of bases) {
            const next = `${cur} ${bb}`.trim();
            const r = new CubeState();
            r.applySequence(next);
            const k = `${Array.from(r.cp as any).join(',')}|${Array.from(r.ep as any).join(',')}`;
            if (seen.has(k)) continue;
            seen.add(k);
            q.push(next);
            const t = b.clone();
            t.applySequence(next);
            if (
              JSON.stringify(Array.from(t.cp as any)) === JSON.stringify(Array.from(a.cp as any)) &&
              JSON.stringify(Array.from(t.ep as any)) === JSON.stringify(Array.from(a.ep as any))
            ) {
              found = next;
              break;
            }
          }
        }
        console.log('sfs is a rotation of entries by:', found || 'NONE (different permutation class)');
      }
    }

    // What does OUR detector actually report for this solve?
    {
      const report = out.timeline.detectionReport;
      const phases = (report as any).phases ?? [];
      console.log('our phases:', phases.map((p: any) => `${p.phaseName}:${p.caseNumber ?? p.case ?? '-'}@${p.startIndex}-${p.endIndex}`).join(' | '));
      console.log('our finalStateSolved:', (report as any).finalStateSolved);
      const pllPhase = phases.find((p: any) => p.phaseName === 'PLL');
      if (pllPhase) {
        console.log('PLL phase object:', JSON.stringify(pllPhase));
      }
      console.log('crossFace:', JSON.stringify((report as any).crossFace), '| crossCase:', JSON.stringify((report as any).crossCase));
      // Probe the actual pre-PLL state with the same crossFace the detector used.
      if (pllPhase) {
        const cf = (report as any).crossFace ?? 'D';
        const pre = new CubeState(
          Array.from(entries[pllPhase.startIndex - 1].state.cp as any) as any,
          Array.from(entries[pllPhase.startIndex - 1].state.co as any) as any,
          Array.from(entries[pllPhase.startIndex - 1].state.ep as any) as any,
          Array.from(entries[pllPhase.startIndex - 1].state.eo as any) as any,
        );
        const r = det.detectWith(pre, { probe: 'last-layer-permutation', crossFace: cf });
        console.log('probe on pre-PLL with crossFace=' + cf + ':', r.queriedSignature, '->', r.entry?.caseNumber ?? 'NULL');
      }
    }
    expect(true).toBe(true);
  });
});
