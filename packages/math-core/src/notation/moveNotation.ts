/**
 * moveNotation.ts — Robust move parsing and Quest-style display normalization.
 *
 * Reconstruction notation from CubeRoot / reco.nz / SpeedcubeQuest carries
 * quirks: Unicode primes (’ ′ ´), numbered turns (U3), repeated faces with no
 * space (U2U), wide moves (r/l/u/...), parenthesized groups, and adjacent
 * same-face moves that Quest folds (U2 U → U'). This module centralizes:
 *
 *   - tokenize(): normalize + split any move string into elementary tokens
 *   - foldAdjacentSameFace(): Quest-style cancellation (U U → U2, U2 U → U', ...)
 *   - stripRotations(): remove x/y/z tokens from a sequence
 *   - leadingUMoves(): extract the leading U moves (pair AUF / setup)
 *   - classification helpers (isRotation, isFaceMove, isUMove)
 */
import { expandWideMoves } from '../MoveExpander';

const PRIME = /[’′´]/g;
/** Letters that start a move token (faces + slices + rotations). */
const FACE = 'URFDLBMESxyz';
const ROTATION_RE = /^[xyz][2']?$/;
const FACE_MOVE_RE = /^[URFDLB][2']?$/;
const U_MOVE_RE = /^U[2']?$/;

/**
 * Split a move string into elementary tokens.
 *
 * Handles: Unicode primes, '↑'/'·'/'↓'/'.' separators, glued tokens (U2U),
 * numbered turns (R3 → R'), wide moves (expanded to face+slice), parenthesized
 * groups.
 */
export function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·↓.]/g, ' ');
  // Drop inline comments ("U R // pair"): everything from // to end of the
  // line is not a move. CubeRoot / Quest embed them inside phase segments.
  // The m flag makes $ match at every line end.
  s = s.replace(/\/\/.*$/gm, ' ');
  // Expand parenthesized groups with a multiplier: "(F D)3" → F D F D F D.
  // Handles a trailing digit after the closing paren (CubeRoot convention).
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\(([^()]*)\)([0-9]+)/g, (_m, group: string, nS: string) =>
      group.trim().repeat(Number(nS)),
    );
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[()]/g, ' ');
  // Insert a space between a token char and a following face char (glued moves).
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, 'g'), '$1 ');
  // Normalize numbered turns: R1 → R, R2 → R2, R3 → R', R4 → (removed), R5 → R, …
  s = s.replace(new RegExp(`([${FACE}])([0-9]+)`, 'g'), (_m, f: string, nS: string) => {
    const n = Number(nS) % 4;
    if (n === 0) return '';
    if (n === 1) return f;
    if (n === 2) return `${f}2`;
    return `${f}'`;
  });
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  const expanded: string[] = [];
  for (const token of tokens) {
    if (token === '2') continue; // stray degree symbol residue
    expanded.push(...expandWideMoves(token));
  }
  return expanded;
}

/** True when the token is a whole-cube rotation (x/y/z variants). */
export function isRotation(token: string): boolean {
  return ROTATION_RE.test(token);
}

/** True when the token is a face move (U/R/F/D/L/B variants). */
export function isFaceMove(token: string): boolean {
  return FACE_MOVE_RE.test(token);
}

/** True when the token is a U-layer move (U/U'/U2). */
export function isUMove(token: string): boolean {
  return U_MOVE_RE.test(token);
}

/** Strip whole-cube rotations from a token array. */
export function stripRotations(moves: string[]): string[] {
  return moves.filter((m) => !isRotation(m));
}

/**
 * Fold adjacent same-face moves into their minimal form (Quest-style):
 *   U U  → U2        U2 U  → U'       U U' → (removed)
 *   U2 U2 → (removed)                 U' U' → U2
 * Rotations are passed through untouched. Only ADJACENT same-face moves are
 * folded — no reordering is ever performed.
 */
export function foldAdjacentSameFace(moves: string[]): string[] {
  const out: string[] = [];
  for (const token of moves) {
    if (!isFaceMove(token)) {
      out.push(token);
      continue;
    }
    const top = out[out.length - 1];
    if (top !== undefined && isFaceMove(top) && top[0] === token[0]) {
      const valueOf = (t: string): number => (t.endsWith("'") ? 3 : t.endsWith('2') ? 2 : 1);
      const combined = (valueOf(top) + valueOf(token)) % 4;
      out.pop();
      if (combined !== 0) {
        const face = top[0];
        out.push(combined === 1 ? face : combined === 2 ? `${face}2` : `${face}'`);
      }
      continue;
    }
    out.push(token);
  }
  return out;
}

/** Extract the leading U moves of a sequence (pair AUF / setup prefix). */
export function leadingUMoves(moves: string[]): string[] {
  const out: string[] = [];
  for (const token of moves) {
    if (isUMove(token)) out.push(token);
    else break;
  }
  return out;
}

/** Strip the leading U moves of a sequence. */
export function withoutLeadingUMoves(moves: string[]): string[] {
  let i = 0;
  while (i < moves.length && isUMove(moves[i])) i++;
  return moves.slice(i);
}

/** Join tokens into a canonical display string. */
export function joinMoves(moves: string[]): string {
  return moves.join(' ');
}
