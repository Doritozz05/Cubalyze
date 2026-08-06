// ─────────────────────────────────────────────────────────────────────────
// Shared manual time input parser (Timer stage + "Add manual solve" sheet).
//
// Core semantics replicate csTimer exactly (cs0x7f/cstimer on GitHub):
//   - src/js/timer/input.js  → parseInput()
//   - src/js/timer.js:791    → intUN setting, default 20100
//                              ("unit when entering an integer",
//                               format h:mm:ss.cs)
//   - src/js/kernel.js:302   → defaultProps[key] = values[0]  (default 20100)
//
// Bare integers are read in 2-digit groups from the right (cs|ss|mm|hh):
//   "10" → 0.10s, "1450" → 14.50s, "23100" → 2:31.00, "1231000" → 1:23:10.00
// A trailing "+" (or "+2") applies the +2 penalty to the TYPED (effective)
// time and stores raw = typed − 2000ms, exactly like csTimer. "DNF" (with an
// optional "(time)" keeping the raw time) logs a DNF solve.
// Several times can be entered at once, separated by commas or newlines.
//
// CubeForge extension (not in csTimer): unit suffixes "90s", "2m30s", "1h".
// ─────────────────────────────────────────────────────────────────────────

import type { Penalty } from '@/types';
import { formatTime } from '@/utils/formatTime';

export interface ParsedManualTime {
  /** Raw solve time in milliseconds (before penalty). DNF → 0. */
  timeMs: number;
  penalty: Penalty;
}

/**
 * csTimer "intUN = 20100" integer reading: 2-digit groups from the right.
 *   "10"     → 0.10s    (cs = 10)
 *   "1450"   → 14.50s   (ss = 14, cs = 50)
 *   "23100"  → 2:31.00  (mm = 2, ss = 31, cs = 00)
 *   "1231000"→ 1:23:10.00 (hh = 1, mm = 23, ss = 10, cs = 00)
 */
function parseIntegerCsTimer(digits: string): number {
  const cs = Number(digits.slice(-2) || '0');
  const ss = Number(digits.slice(-4, -2) || '0');
  const mm = Number(digits.slice(-6, -4) || '0');
  const hh = Number(digits.slice(0, -6) || '0');
  return hh * 3_600_000 + mm * 60_000 + ss * 1000 + cs * 10;
}

/**
 * Core csTimer grammar (input.js), trimmed to what the app needs:
 *   [N. ] (DNF)? h:m:s.cs (+|+2)?
 * Same lazy groups as csTimer, so "12:34" reads as 12m34s, not 1:02:34.
 */
const ENTRY_RE =
  /^(?:\d+\.\s+)?\(?\s*(DNF)?\s*\(?(\d*?):?(\d*?):?(\d*\.?\d*?)(\+2?)?\)?$/i;

/** "90s" → 90000, "1.5h" → 5400000, "10ms" → 10. */
function parseUnitSuffix(raw: string): number | null {
  const match = raw.match(/^([\d.]+)\s*(h|ms|m|s)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  switch (match[2].toLowerCase()) {
    case 'h':
      return Math.round(value * 3_600_000);
    case 'm':
      return Math.round(value * 60_000);
    case 's':
      return Math.round(value * 1000);
    case 'ms':
      return Math.round(value);
  }
  return null;
}

/** "90s", "2m30s", "1h30m", "1h30m45.5s" — must consume the whole string. */
function parseUnitString(raw: string): number | null {
  if (!/[hms]$/i.test(raw)) return null;
  const compact = raw.replace(/\s+/g, '');
  // "ms" must come before "m" and "s" so "10ms" is not read as "10m".
  const parts = compact.match(/[\d.]+(?:h|ms|m|s)/gi);
  if (!parts || parts.join('') !== compact) return null;
  let total = 0;
  for (const part of parts) {
    const ms = parseUnitSuffix(part);
    if (ms === null) return null;
    total += ms;
  }
  return total > 0 ? total : null;
}

/**
 * Parse a single time entry (one solve). Returns null if invalid.
 */
function parseEntry(raw: string): ParsedManualTime | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // CubeForge extension: unit-suffixed values.
  const unitMs = parseUnitString(trimmed.toLowerCase());
  if (unitMs !== null) return { timeMs: unitMs, penalty: 'none' };

  const m = ENTRY_RE.exec(trimmed);
  if (!m) return null;

  const isDnf = m[1] !== undefined;
  const h = m[2] ?? '';
  const mi = m[3] ?? '';
  const s = m[4] ?? '';
  const hasPlus = m[5] !== undefined;

  const hh = Number(h || 0);
  const mm = Number(mi || 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0) return null;

  let timeMs = hh * 3_600_000 + mm * 60_000 + Number(s || 0) * 1000;
  if (!Number.isFinite(timeMs) || timeMs < 0) return null;

  // csTimer intUN=20100: integer without colons → 2-digit groups (cs|ss|mm|hh).
  if (h === '' && mi === '' && /^\d+$/.test(s)) {
    timeMs = parseIntegerCsTimer(s);
  }

  timeMs = Math.round(timeMs);

  if (isDnf) return { timeMs: Math.max(0, timeMs), penalty: 'DNF' };

  // "+"/"+2": the typed value already includes the +2 penalty (csTimer
  // semantics). csTimer only applies it when the time exceeds 2000ms.
  if (hasPlus && timeMs > 2000) {
    return { timeMs: timeMs - 2000, penalty: '+2' };
  }

  if (timeMs <= 0) return null;
  return { timeMs, penalty: 'none' };
}

/**
 * Parse a manual time input into one or more solves.
 *
 * Multiple entries may be separated by commas or newlines. The input is
 * all-or-nothing: if any entry fails to parse, the whole input returns null
 * (safer than silently dropping solves).
 */
export function parseTimeInput(input: string): ParsedManualTime[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const entries = trimmed
    .split(/[,\n]/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;

  const result: ParsedManualTime[] = [];
  for (const entry of entries) {
    const parsed = parseEntry(entry);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
}

/**
 * Short human display of one parsed entry, echoing what csTimer shows:
 *   { 14500, "none" } → "14.50"
 *   { 13500, "+2" }   → "15.50+"   (effective time + marker)
 *   { 0, "DNF" }      → "DNF"
 *   { 12340, "DNF" }  → "DNF(12.34)"
 */
export function formatManualEntry(parsed: ParsedManualTime): string {
  if (parsed.penalty === 'DNF') {
    return parsed.timeMs > 0 ? `DNF(${formatTime(parsed.timeMs)})` : 'DNF';
  }
  if (parsed.penalty === '+2') {
    return `${formatTime(parsed.timeMs + 2000)}+`;
  }
  return formatTime(parsed.timeMs);
}

/** Live preview for an input: "= 14.50" or "×3 12.34 · 11.05 · 13.01 …". */
export function formatManualPreview(parsed: ParsedManualTime[]): string | null {
  if (!parsed || parsed.length === 0) return null;
  const MAX_SHOW = 3;
  const shown = parsed
    .slice(0, MAX_SHOW)
    .map(formatManualEntry)
    .join(' · ');
  const rest = parsed.length > MAX_SHOW ? ` … +${parsed.length - MAX_SHOW}` : '';
  const prefix = parsed.length > 1 ? `×${parsed.length} ` : '= ';
  return `${prefix}${shown}${rest}`;
}
