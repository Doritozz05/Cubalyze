/**
 * smart-cube-id.ts — the canonical form of a smart cube's hardware identity.
 *
 * A smart cube is recognised by its Bluetooth address, and that address reaches
 * us from three places that do NOT agree on spelling:
 *
 *   • the advertisement / `System ID` read, which the GAN protocol walks
 *     **backwards** (`extractMAC` in `@cubeforge/gan-protocol` pushes the bytes
 *     from the end of the buffer), so the string it produces is the MAC with its
 *     bytes in reverse order;
 *   • the user typing it by hand (the manual fallback in the connector, or the
 *     label under their cube), in the printed order;
 *   • whatever separators a person or a phone keyboard produced
 *     (`AA:BB:…`, `aa-bb-…`, `AA BB …`).
 *
 * Comparing those literally means "the same cube stops matching itself", so the
 * Locker stores ONE canonical form and every comparison goes through here.
 *
 * This module lives in the database package because the column it feeds
 * (`gear_items.smart_id`) is defined here, and because both the repository (on
 * write) and the web layer (when resolving a link) must apply the same rule. It
 * is pure: no I/O, no React, so every case below is unit-testable.
 */

/** A canonical identity: 12 uppercase hex digits, separators stripped. */
export type NormalizedSmartId = string;

/** Separators a human or a keyboard may insert between the bytes. */
const SEPARATORS = /[\s:.\-_]/g;

/**
 * Canonicalise a smart cube id, or `null` when it cannot be one.
 *
 * Only separators are removed — not arbitrary characters. That matters: a value
 * like `"SN-1234"` must stay invalid instead of being quietly coerced into
 * something that looks like an address, and the column is documented as a MAC,
 * not a free-form serial (the Locker has `serial` for that).
 */
export function normalizeSmartId(raw: string | null | undefined): NormalizedSmartId | null {
  if (typeof raw !== 'string') return null;
  const hex = raw.replace(SEPARATORS, '').toUpperCase();
  if (hex.length !== 12 || !/^[0-9A-F]{12}$/.test(hex)) return null;
  return hex;
}

/** `AABBCCDDEEFF` → `AA:BB:CC:DD:EE:FF`, for display. Null when invalid. */
export function formatSmartId(raw: string | null | undefined): string | null {
  const normalized = normalizeSmartId(raw);
  if (!normalized) return null;
  return normalized.match(/.{2}/g)!.join(':');
}

/** Reverse the byte order of a canonical id (not the characters). */
export function reverseSmartIdBytes(normalized: NormalizedSmartId): NormalizedSmartId {
  const bytes = normalized.match(/.{2}/g);
  if (!bytes) return normalized;
  return bytes.reverse().join('');
}

/**
 * Do two spellings refer to the same cube?
 *
 * True when they are equal after normalisation **or** when one is the byte
 * reversal of the other, because the protocol reads the address backwards while
 * a printed label (and therefore a hand-typed value) does not. Without hardware
 * in front of us both orders are legitimate, so accepting either is the honest
 * rule; the plan records that this must be confirmed against a real cube
 * (`Plan-Fase5-SmartCube-Locker-2026-09.md` §2.2, risk R1).
 *
 * The only way this can be wrong is two cubes whose addresses are exact byte
 * reversals of each other — a ~1-in-140-trillion coincidence among the handful
 * of cubes one person owns, which is why it is accepted rather than paid for
 * with a mismatch that would silently break the common case.
 */
export function smartIdsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeSmartId(a);
  const right = normalizeSmartId(b);
  if (!left || !right) return false;
  return left === right || reverseSmartIdBytes(left) === right;
}
