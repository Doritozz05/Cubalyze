/**
 * reconstructionAnalyzer.ts — End-to-end reconstruction analysis.
 *
 * Pipeline (mirrors the audit's PHASE diagram):
 *
 *   Scramble + phase moves
 *     → tokenize (robust parser)
 *     → replay → CubeState per token (literal, rotations applied to the cube)
 *     → color-scheme detection at the cross completion → recolor into the
 *       catalog scheme (U↔D swap when the solver's cross color is the
 *       catalog's U letter) — the whole replay is re-expressed in one scheme
 *     → coherence check (final solved, up to a frame rotation)
 *     → per-phase verification + case recognition:
 *         Cross   → cross on D in some frame
 *         F2L     → the slot that transitioned to complete + pair case + AUF
 *         OLL     → last-layer orientation signature → case + AUF
 *         PLL     → last-layer permutation signature → case + AUF
 *     → Quest-style display folding (adjacent same-face cancellation)
 *
 * Slot NAMING and COMPLETION are evaluated in the cross-on-D FRAME derived
 * from the actual state (findCrossOnDFrames), so missing/extra rotations in
 * the transcription cannot break them. Every detection is state-based and
 * justified (see `debug`); nothing here matches move strings.
 */
import { CubeState } from '@cubeforge/math-core';
import {
  tokenize,
  stripRotations,
  leadingUMoves,
  foldAdjacentSameFace,
  isRotation,
} from './moveNotation';
import {
  ROTATION_GROUP,
  applyRotation,
  findRotationOfSolved,
  isRotationOfReference,
  findCrossOnDFrames,
} from './rotationGroup';
import {
  type Convention,
  type ColorRemap,
  CATALOG_CONVENTION,
  INVERTED_CONVENTION,
  FALLBACK_CONVENTIONS,
  U_D_SWAP_REMAP,
  applyColorRemap,
  detectConventionFromColors,
} from './conventions';
import { f2lPairSignature, ollSignatureWithAuf, pllSignatureWithAuf } from './signatures';
import { getRecognitionIndex, resolveMatch, type CaseMatch } from './caseIndex';

export type SlotName = 'FR' | 'FL' | 'BL' | 'BR';

export interface InputPhase {
  name: string;
  moves: string;
}

export interface AnalyzedPhase {
  name: string;
  moves: string[];
  /** Quest-style folded display (adjacent same-face cancellation). */
  displayMoves: string[];
  startIndex: number;
  endIndex: number;
}

export interface PairResult {
  phaseIndex: number;
  caseMatch: CaseMatch;
  /** The single slot that became complete during this phase (null when multi). */
  slot: SlotName | null;
  slotsCompleted: SlotName[];
  /** Leading U moves of the phase (the pair AUF). */
  aufMove: string[];
  /** Exactly one slot completed and the signature matched. */
  verified: boolean;
  frame: string;
  grip: string;
}

export interface OllResult {
  phaseIndex: number;
  caseMatch: CaseMatch;
  /** AUF offset (0-3) aligning the canonical orientation. */
  auf: number | null;
  /** Last layer oriented at the phase end. */
  verified: boolean;
  frame: string;
}

export interface PllResult {
  phaseIndex: number;
  caseMatch: CaseMatch;
  /** AUF offset (0-3) aligning the canonical permutation. */
  auf: number | null;
  /** Final state solved (exactly or up to a rotation). */
  verified: boolean;
  frame: string;
}

export interface ReconstructionAnalysis {
  phases: AnalyzedPhase[];
  tokens: string[];
  states: CubeState[];
  finalSolved: boolean;
  finalRotation: string | null;
  /**
   * Whole-cube rotations prepended to the replay (after the scramble) to
   * recover the solver's inspection when the transcription strips it (e.g.
   * SpeedcubeQuest's display). Empty when none was needed or found.
   */
  inspection: string;
  convention: Convention | null;
  colorRemap: ColorRemap | null;
  crossVerified: boolean;
  pairs: PairResult[];
  oll: OllResult | null;
  pll: PllResult | null;
  /** Index stats (for audit/metrics). */
  indexStats: {
    f2lCases: number;
    f2lUnindexed: string[];
    f2lCollisions: number;
    ollCases: number;
    ollUnindexed: string[];
    pllCases: number;
    pllUnindexed: string[];
  };
  debug: string[];
}

const CATALOG_FALLBACK = [4, 5, 6, 7];

/** The solved cube in the U↔D-inverted color scheme (white = pieces 0-3).
 *  Empirically verified NOT to be a rotation of the catalog solved — so the
 *  two schemes are distinguishable by a final-state rotation check. */
const INVERTED_SOLVED: CubeState = applyColorRemap(new CubeState(), U_D_SWAP_REMAP);

const CATALOG_SOLVED: CubeState = new CubeState();

/** Fold same-axis rotation tokens into minimal notation (x x → x2). */
function foldRotations(tokens: string[]): string {
  const out: string[] = [];
  for (const token of tokens) {
    const top = out[out.length - 1];
    if (top !== undefined && top[0] === token[0]) {
      const valueOf = (t: string): number => (t.endsWith("'") ? 3 : t.endsWith('2') ? 2 : 1);
      const combined = (valueOf(top) + valueOf(token)) % 4;
      out.pop();
      if (combined !== 0) {
        out.push(combined === 1 ? top[0] : combined === 2 ? `${top[0]}2` : `${top[0]}'`);
      }
      continue;
    }
    out.push(token);
  }
  return out.join(' ');
}

/**
 * Find the whole-cube rotation R such that replay(scramble → R → phases)
 * ends in a rotation of the catalog (or U↔D-inverted) solved cube. Quest and
 * other viewers strip the solver's inspection from their display; this
 * recovers it deterministically by trying the 24-element rotation group. The
 * final-state test is exact (a wrong R leaves the cube genuinely scrambled),
 * so false positives are impossible in practice; the cross-completion check
 * breaks remaining ties (solve symmetries). Returns '' when no R works.
 */
function findCoherentInspection(scrambled: CubeState, phases: AnalyzedPhase[]): string {
  const candidates: string[] = [];
  for (const R of ROTATION_GROUP) {
    const s = applyRotation(scrambled, R);
    for (const ph of phases) for (const t of ph.moves) s.applySequence(t);
    if (isRotationOfReference(s, CATALOG_SOLVED) || isRotationOfReference(s, INVERTED_SOLVED)) {
      candidates.push(R);
    }
  }
  if (candidates.length === 0) return '';
  if (candidates.length === 1) return candidates[0];
  // Tie-break: prefer the candidate whose cross phase leaves a completed
  // cross on D (standard or inverted) — a genuine inspection does; a
  // symmetry artifact usually does not.
  const crossIdx = phases.findIndex((p) => /cross/i.test(p.name));
  if (crossIdx >= 0) {
    for (const R of candidates) {
      const s = applyRotation(scrambled, R);
      for (let i = 0; i <= crossIdx; i++) for (const t of phases[i].moves) s.applySequence(t);
      const standard = findCrossOnDFrames(s, CATALOG_CONVENTION.crossEdges).length > 0;
      const inverted =
        !standard && findCrossOnDFrames(s, INVERTED_CONVENTION.crossEdges).length > 0;
      if (standard || inverted) return R;
    }
  }
  return candidates[0];
}

const SLOTS: { name: SlotName; cornerPos: number; edgePos: number }[] = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

/**
 * Slot completion, evaluated in the cross-on-D frame: rotate the state into
 * the solver's frame (view = frame·state) and check the 4 slot positions
 * (4,8)/(5,9)/(6,10)/(7,11) against the frame's home (frame·solved). This is
 * independent of the stream's recorded rotations — the frame is derived from
 * the actual cross placement, so missing/extra rotations in the transcription
 * cannot break it.
 */
function slotComplete(
  state: CubeState,
  frame: string,
  cornerPos: number,
  edgePos: number,
): boolean {
  const view = applyRotation(state, frame);
  const home = applyRotation(new CubeState(), frame);
  return (
    view.cp[cornerPos] === home.cp[cornerPos] &&
    view.co[cornerPos] === 0 &&
    view.ep[edgePos] === home.ep[edgePos] &&
    view.eo[edgePos] === 0
  );
}

function firstCrossFrame(state: CubeState, crossEdges: readonly number[]): string | null {
  const frames = findCrossOnDFrames(state, crossEdges);
  return frames.length > 0 ? frames[0] : null;
}

function lastLayerOriented(state: CubeState): boolean {
  return (
    Array.from(state.co).slice(0, 4).every((o) => o === 0) &&
    Array.from(state.eo).slice(0, 4).every((o) => o === 0)
  );
}

/**
 * Analyze a reconstruction: phases with their move strings, plus the WCA
 * scramble they were solved from (optional — when omitted the analysis starts
 * from a solved cube, which is only meaningful for synthetic inputs).
 *
 * `initialState` (default: solved) lets tests simulate a solver's color
 * scheme by starting the replay from the recolored solved cube — the whole
 * stream is then expressed in that raw scheme and the scheme detection
 * remaps it back to the catalog convention.
 */
export function analyzeReconstruction(input: {
  scramble?: string;
  phases: InputPhase[];
  initialState?: CubeState;
  /**
   * The solver's inspection (e.g. "x2") — reconstructions from CubeRoot /
   * Quest write the moves in the solver's coordinate system, so the replay
   * must start from inspection·solved (the solver's grip) instead of solved.
   * Shorthand for `initialState: applyRotation(solved, inspection)`.
   */
  inspection?: string;
  /**
   * When the raw replay does not return to a solved cube (transcriptions
   * that strip the inspection), search the rotation group for the inspection
   * that makes it coherent. Default true.
   */
  recoverInspection?: boolean;
}): ReconstructionAnalysis {
  const debug: string[] = [];
  const index = getRecognitionIndex();
  const indexStats = {
    f2lCases: index.f2lCases,
    f2lUnindexed: index.f2lUnindexed,
    f2lCollisions: index.f2lCollisions,
    ollCases: index.ollCases,
    ollUnindexed: index.ollUnindexed,
    pllCases: index.pllCases,
    pllUnindexed: index.pllUnindexed,
  };

  // ── 1. Tokenize + phase ranges ────────────────────────────────────────
  const phases: AnalyzedPhase[] = [];
  const tokens: string[] = [];
  let cursor = 0;
  for (const phase of input.phases) {
    const moves = tokenize(phase.moves);
    phases.push({
      name: phase.name,
      moves,
      displayMoves: foldAdjacentSameFace(moves),
      startIndex: cursor,
      endIndex: cursor + moves.length - 1,
    });
    tokens.push(...moves);
    cursor += moves.length;
  }

  // ── 2. Replay (literal — rotations are applied to the cube) ───────────
  // Track the solver's grip: the accumulated rotation tokens (their frame).
  // The scramble goes through the same tokenizer as the moves (wide moves,
  // numbered turns, glued tokens), so setups like "r U2' R' … M" replay
  // exactly as the seed's CaseStateGenerator parses them.
  const scrambleTokens = input.scramble ? tokenize(input.scramble) : [];
  const rawStart = input.initialState
    ? input.initialState.clone()
    : input.inspection
      ? (() => {
          const s = new CubeState();
          s.applySequence(input.inspection!);
          return s;
        })()
      : new CubeState();
  const scrambled = rawStart.clone();
  for (const t of scrambleTokens) scrambled.applySequence(t);

  // ── 2a. Inspection recovery (Quest-style streams strip it) ─────────────
  // First check the raw replay (no inspection): if it already returns to a
  // solved cube, nothing to recover. Otherwise search the rotation group for
  // the exact inspection (see findCoherentInspection — exact final test).
  let inspection = '';
  if (input.recoverInspection !== false) {
    let probe = scrambled.clone();
    for (const token of tokens) probe.applySequence(token);
    const coherent =
      probe.isSolved() ||
      isRotationOfReference(probe, CATALOG_SOLVED) ||
      isRotationOfReference(probe, INVERTED_SOLVED);
    if (!coherent) inspection = findCoherentInspection(scrambled, phases);
    if (inspection) {
      inspection = foldRotations(inspection.split(' '));
    }
    if (inspection) {
      debug.push(`inspection: recovered "${inspection}" from the rotation group (transcription stripped it)`);
    }
  }

  // ── 2b. Replay (literal — rotations are applied to the cube) ───────────
  // The scramble goes through the same tokenizer as the moves (wide moves,
  // numbered turns, glued tokens), so setups like "r U2' R' … M" replay
  // exactly as the seed's CaseStateGenerator parses them.
  let state = scrambled.clone();
  if (inspection) state.applySequence(inspection);
  const rawInitial = state.clone();
  const rawStates: CubeState[] = [];
  const grips: (string | null)[] = [];
  const gripTokens: string[] = inspection ? [inspection] : [];
  for (const token of tokens) {
    state.applySequence(token);
    if (isRotation(token)) gripTokens.push(token);
    rawStates.push(state.clone());
    grips.push(gripTokens.join(' '));
  }

  const rawPostOf = (phase: AnalyzedPhase): CubeState | null =>
    phase.endIndex >= 0
      ? rawStates[phase.endIndex]
      : phase.startIndex === 0
        ? rawInitial
        : rawStates[phase.startIndex - 1];

  // ── 3. Color scheme → catalog (decided by the FINAL state) ────────────
  // A faithful solve's final state must be a rotation of the scheme's own
  // solved cube. The two candidate solved cubes — catalog (white = pieces
  // 4-7 on D) and U↔D-inverted (white = pieces 0-3) — are NOT rotations of
  // each other (verified: recolor(solved) is not a rotation of solved), so
  // the raw final determines the scheme uniquely. This is strictly stronger
  // than cross-end sticker/edge evidence, which misreads when the
  // transcription defers the final regrip out of the Cross phase (cross on a
  // side face at the annotated cross end — e.g. recon #2510). Cross-end
  // evidence remains the fallback for non-faithful/incomplete transcriptions
  // (DNF, missing AUF, pasted partial streams).
  const crossPhaseIndex = phases.findIndex((p) => /cross/i.test(p.name));
  const rawFinalState = rawStates.length > 0 ? rawStates[rawStates.length - 1] : state.clone();
  const rawFinalIsCatalog = findRotationOfSolved(rawFinalState) !== null;
  const rawFinalIsInverted = isRotationOfReference(rawFinalState, INVERTED_SOLVED);
  let colorRemap: ColorRemap | null = null;
  if (rawFinalIsInverted && !rawFinalIsCatalog) {
    colorRemap = U_D_SWAP_REMAP;
    debug.push(
      'convention: final is a rotation of the U↔D-inverted solved ⇒ inverted scheme ⇒ remap U↔D',
    );
  } else if (rawFinalIsCatalog && !rawFinalIsInverted) {
    colorRemap = null;
    debug.push('convention: final is a rotation of the catalog solved ⇒ standard scheme, no remap');
  } else if (crossPhaseIndex >= 0) {
    // Final inconclusive (unfaithful/incomplete transcription) — fall back to
    // the cross-end evidence. NOTE: a completed cross shows identical edge
    // stickers on BOTH the cross face and the LL face, so this fallback can
    // misread a cross completed on a side face — it is a last resort only.
    const crossEnd = rawPostOf(phases[crossPhaseIndex]);
    if (crossEnd !== null) {
      const standard = findCrossOnDFrames(crossEnd, CATALOG_CONVENTION.crossEdges).length > 0;
      const inverted =
        !standard && findCrossOnDFrames(crossEnd, INVERTED_CONVENTION.crossEdges).length > 0;
      colorRemap = inverted ? U_D_SWAP_REMAP : null;
      debug.push(
        `convention: final inconclusive — cross-end [4-7]=${standard} [0-3]=${inverted} → remap=${inverted ? 'U↔D' : 'none'}`,
      );
    }
  } else {
    debug.push('convention: no final/cross evidence — standard scheme assumed');
  }
  const states = colorRemap ? rawStates.map((s) => applyColorRemap(s, colorRemap)) : rawStates;

  // ── 4. Coherence (against the scheme's own solved cube: the catalog solved
  //   when no remap, else the recolored solved — recolor(solved) is a valid
  //   cube that need not be a rotation of the catalog solved) ─
  const finalState = states.length > 0 ? states[states.length - 1] : state.clone();
  const schemeSolved = colorRemap ? applyColorRemap(new CubeState(), colorRemap) : new CubeState();
  const finalSolved = finalState.isSolved() || isRotationOfReference(finalState, schemeSolved);
  const finalRotation = finalState.isSolved() ? null : findRotationOfSolved(finalState);
  debug.push(
    `coherence: final solved-in-scheme=${finalSolved}` +
      (finalRotation ? ` (rotation of catalog solved: ${finalRotation})` : finalSolved ? '' : ' — NOT coherent'),
  );

  const preStateOf = (phase: AnalyzedPhase): CubeState =>
    phase.startIndex === 0
      ? (() => {
          const s = scrambled.clone();
          if (inspection) s.applySequence(inspection);
          return colorRemap ? applyColorRemap(s, colorRemap) : s;
        })()
      : states[phase.startIndex - 1];
  const postStateOf = (phase: AnalyzedPhase): CubeState =>
    phase.endIndex >= 0 ? states[phase.endIndex] : preStateOf(phase);

  // ── 5. Convention ─────────────────────────────────────────────────────
  // When the final state proves the scheme, the convention is fixed by it:
  // recolored (inverted) ⇒ catalog; raw-standard ⇒ catalog. Color/piece-based
  // detection only runs when the final is inconclusive — the 2510 shows it
  // can contradict a final-proven scheme when the cross phase defers its
  // regrip (cross on a side face at the annotated cross end).
  let convention: Convention | null = null;
  if (colorRemap) {
    convention = CATALOG_CONVENTION; // recolored states are in the catalog scheme
  } else if (rawFinalIsCatalog && !rawFinalIsInverted) {
    convention = CATALOG_CONVENTION; // final proves the standard scheme
  } else if (crossPhaseIndex >= 0) {
    if (findCrossOnDFrames(postStateOf(phases[crossPhaseIndex]), CATALOG_CONVENTION.crossEdges).length > 0) {
      convention = CATALOG_CONVENTION;
    }
  }
  if (convention === null && crossPhaseIndex >= 0) {
    const crossEnd = postStateOf(phases[crossPhaseIndex]);
    convention = detectConventionFromColors(crossEnd);
    if (convention === null) {
      debug.push('convention: piece detection failed, trying fallback conventions');
      for (const fallback of FALLBACK_CONVENTIONS) {
        if (findCrossOnDFrames(crossEnd, fallback.crossEdges).length > 0) {
          convention = fallback;
          break;
        }
      }
    }
  }
  if (convention === null) debug.push('convention: NOT detected — case recognition disabled');
  else debug.push(
    `convention: crossEdges=[${convention.crossEdges}] clCorners=[${convention.clCorners}] ` +
      `llCorners=[${convention.llCorners}] llEdges=[${convention.llEdges}]`,
  );
  const crossEdges = convention?.crossEdges ?? CATALOG_FALLBACK;

  // ── 6. Cross verification ─────────────────────────────────────────────
  let crossVerified = false;
  if (crossPhaseIndex >= 0) {
    crossVerified = findCrossOnDFrames(postStateOf(phases[crossPhaseIndex]), crossEdges).length > 0;
    debug.push(`cross: verified=${crossVerified} (phase "${phases[crossPhaseIndex].name}")`);
  }

  // ── 7. F2L pairs ──────────────────────────────────────────────────────
  // A phase may annotate ONE pair (CubeRoot/Quest: "F2L 1 …") or a whole
  // F2L segment (the stats pipeline's PhaseSplitter emits a single "F2L"
  // phase). We walk the phase's tokens and record every slot that completes
  // (incomplete→complete in the cross-on-D frame), one pair result per
  // completion. The case signature is read at the START of each pair, from
  // the pair's pre-state in the cross-on-D frame (robust to missing
  // rotations and to internal y-regrips: each slot is checked in the frame's
  // own positions).
  const pairs: PairResult[] = [];
  phases.forEach((phase, phaseIndex) => {
    if (!/f2l|pair/i.test(phase.name)) return;
    const pre = preStateOf(phase);
    const post = postStateOf(phase);
    const postGrip = grips[phase.endIndex] ?? '';

    // Transcriptions often defer the cross-completing regrip out of the
    // Cross phase (the first rotation of F2L 1 completes it). Fold the
    // phase's LEADING rotation prefix into pre so the cross-on-D frame can
    // be found even when the annotated pre-state does not yet have the cross
    // on D.
    const rotPrefix: string[] = [];
    for (const m of phase.moves) {
      if (isRotation(m)) rotPrefix.push(m);
      else break;
    }
    const rotPrefixSeq = rotPrefix.join(' ');
    const sigBase = rotPrefixSeq ? applyRotation(pre, rotPrefixSeq) : pre;
    const frame =
      firstCrossFrame(pre, crossEdges) ??
      firstCrossFrame(sigBase, crossEdges) ??
      firstCrossFrame(post, crossEdges);

    const home = frame !== null ? applyRotation(new CubeState(), frame) : null;
    const slotOf = (name: SlotName): { cornerPos: number; edgePos: number } =>
      SLOTS.find((s) => s.name === name)!;

    const pairEntries: {
      slot: SlotName;
      pairStart: number;
      caseMatch: CaseMatch;
      verified: boolean;
    }[] = [];
    if (convention !== null && frame !== null && home !== null) {
      const seen = new Set<SlotName>();
      for (const slot of SLOTS) {
        if (slotComplete(pre, frame, slot.cornerPos, slot.edgePos)) seen.add(slot.name);
      }
      let pairStart = phase.startIndex;
      const completions: { slot: SlotName; index: number }[] = [];
      for (let i = phase.startIndex; i <= phase.endIndex; i++) {
        const st = states[i];
        for (const slot of SLOTS) {
          if (
            !seen.has(slot.name) &&
            slotComplete(st, frame, slot.cornerPos, slot.edgePos)
          ) {
            seen.add(slot.name);
            completions.push({ slot: slot.name, index: i });
          }
        }
      }
      for (const comp of completions) {
        const pairPre =
          pairStart > phase.startIndex ? states[pairStart - 1] : sigBase;
        const { cornerPos, edgePos } = slotOf(comp.slot);
        const view = applyRotation(pairPre, frame);
        const cornerHome = home.cp[cornerPos];
        const edgeHome = home.ep[edgePos];
        const sig = f2lPairSignature(view, crossEdges, cornerHome, edgeHome);
        const match = resolveMatch(index.f2l, sig);
        // A pair arrangement is never case-ambiguous: several numbers sharing
        // a signature mean the same arrangement (advanced cases reusing a
        // basic pair). Prefer the first (basic) number.
        const caseMatch: CaseMatch = { ...match, ambiguous: false };
        debug.push(
          `F2L "${phase.name}": pair ${comp.slot} sig=${sig ? sig.slice(0, 50) + '…' : 'null'} → ` +
            `${caseMatch.caseNumber ?? 'UNKNOWN'}` +
            (caseMatch.candidates.length > 1
              ? ` (${caseMatch.candidates.length} numbers share this arrangement: ${caseMatch.candidates.join(',')})`
              : ''),
        );
        pairEntries.push({
          slot: comp.slot,
          pairStart,
          caseMatch,
          verified: caseMatch.caseNumber !== null,
        });
        pairStart = comp.index + 1;
      }
      if (completions.length === 0) {
        debug.push(`F2L "${phase.name}": 0 slots completed — skipped`);
      }
    } else {
      debug.push(
        `F2L "${phase.name}": ${convention === null ? 'no convention' : 'no cross-on-D frame'} — skipped`,
      );
    }

    const slotsCompleted = pairEntries.map((p) => p.slot);
    debug.push(
      `F2L "${phase.name}": slots completed=[${slotsCompleted.join(',')}] grip=${postGrip || '(identity)'} ` +
        `frame=${frame ?? '(none)'}`,
    );

    if (pairEntries.length === 0) {
      // Honest UNKNOWN: the phase completed no slot (broken transcription,
      // interference, or multislotting) — never guess a case.
      pairs.push({
        phaseIndex,
        caseMatch: { caseNumber: null, candidates: [], ambiguous: false },
        slot: null,
        slotsCompleted,
        aufMove: leadingUMoves(stripRotations(phase.moves)),
        verified: false,
        frame: frame ?? '',
        grip: postGrip,
      });
    } else {
      for (const pe of pairEntries) {
        pairs.push({
          phaseIndex,
          caseMatch: pe.caseMatch,
          slot: pe.slot,
          slotsCompleted,
          aufMove: leadingUMoves(stripRotations(phase.moves)),
          verified: pe.verified,
          frame: frame ?? '',
          grip: postGrip,
        });
      }
    }
  });

  // ── 8. OLL ────────────────────────────────────────────────────────────
  let oll: OllResult | null = null;
  const ollPhaseIndex = phases.findIndex((p) => /oll/i.test(p.name));
  if (ollPhaseIndex >= 0 && convention !== null) {
    const phase = phases[ollPhaseIndex];
    const pre = preStateOf(phase);
    const frame = firstCrossFrame(pre, crossEdges);
    const detected = frame !== null ? ollSignatureWithAuf(pre, crossEdges) : null;
    const caseMatch = detected
      ? resolveMatch(index.oll, detected.sig)
      : { caseNumber: null, candidates: [], ambiguous: false };
    debug.push(
      `OLL: sig=${detected?.sig ?? 'null'} → ${caseMatch.caseNumber ?? 'UNKNOWN'} ` +
        `(auf=${detected?.auf}) verified=${lastLayerOriented(postStateOf(phase))}`,
    );
    oll = {
      phaseIndex: ollPhaseIndex,
      caseMatch,
      auf: detected?.auf ?? null,
      verified: lastLayerOriented(postStateOf(phase)),
      frame: frame ?? '',
    };
  }

  // ── 9. PLL ────────────────────────────────────────────────────────────
  let pll: PllResult | null = null;
  const pllPhaseIndex = phases.findIndex((p) => /pll/i.test(p.name));
  if (pllPhaseIndex >= 0 && convention !== null) {
    const phase = phases[pllPhaseIndex];
    const pre = preStateOf(phase);
    const frame = firstCrossFrame(pre, crossEdges);
    const detected = frame !== null ? pllSignatureWithAuf(pre, crossEdges) : null;
    const caseMatch = detected
      ? resolveMatch(index.pll, detected.sig)
      : { caseNumber: null, candidates: [], ambiguous: false };
    debug.push(
      `PLL: sig=${detected?.sig ?? 'null'} → ${caseMatch.caseNumber ?? 'UNKNOWN'} ` +
        `(auf=${detected?.auf}) verified=${finalSolved || finalRotation !== null}`,
    );
    pll = {
      phaseIndex: pllPhaseIndex,
      caseMatch,
      auf: detected?.auf ?? null,
      verified: finalSolved || finalRotation !== null,
      frame: frame ?? '',
    };
  }

  return {
    phases,
    tokens,
    states,
    finalSolved,
    finalRotation,
    inspection,
    convention,
    colorRemap,
    crossVerified,
    pairs,
    oll,
    pll,
    indexStats,
    debug,
  };
}
