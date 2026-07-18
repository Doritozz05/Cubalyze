/**
 * CubeState Proxy Adapters — V2 (all agent fixes applied)
 *
 * Provides backward-compatible array-like access (cp[i], co[i], ep[i], eo[i])
 * over the internal bigint representation.
 *
 * DESIGN: These Proxies are ONLY for the external API. Internal hot-path
 * methods (applyMove, multiply, clone, isSolved) operate DIRECTLY on
 * bigints. The Proxies are NEVER in performance-critical code paths.
 *
 * Bit layout (SebLague-compatible, stored LSB at position 0):
 *   Corners: [OOCCC] × 8 — 2-bit orientation (bits 3-4) + 3-bit piece ID (bits 0-2)
 *   Edges:   [OEEEE] × 12 — 1-bit orientation (bit 4) + 4-bit piece ID (bits 0-3)
 */

const BITS_PER_ENTRY = 5n;
const FULL_ENTRY_MASK = 0b11111n;

export interface CubeStateInternal {
  _edges: bigint;
  _corners: bigint;
}

interface AdapterConfig {
  field: 'edges' | 'corners';
  length: number;
  valueMask: bigint;   // mask for the value bits within a 5-bit entry
  bitOffset: bigint;   // how many bits to shift within the 5-bit entry
}

/** Array-like adapter type with index signature for TypeScript compatibility */
export interface CubeAdapter {
  readonly length: number;
  [index: number]: number;
  set(arrayLike: ArrayLike<number> | Iterable<number>): void;
  [Symbol.iterator](): IterableIterator<number>;
}

/** Int8Array-like proxy that reads/writes specific bit fields in a bigint */
function createAdapter(cfg: AdapterConfig, cube: CubeStateInternal) {
  const { field, length, valueMask, bitOffset } = cfg;
  const indices = Array.from({ length }, (_, i) => i);

  function getBigint(): bigint {
    return field === 'edges' ? cube._edges : cube._corners;
  }
  function setBigint(v: bigint): void {
    if (field === 'edges') cube._edges = v;
    else cube._corners = v;
  }

  function readEntry(bi: bigint, idx: number): number {
    const shift = BigInt(idx) * BITS_PER_ENTRY;
    const fullEntry = (bi >> shift) & FULL_ENTRY_MASK;
    const value = (fullEntry >> bitOffset) & valueMask;
    return Number(value);
  }

  function writeEntry(bi: bigint, idx: number, val: number): bigint {
    const shift = BigInt(idx) * BITS_PER_ENTRY;
    const entryShift = shift + bitOffset;
    const clearMask = ~(valueMask << entryShift);
    const newBits = (BigInt(Math.trunc(val)) & valueMask) << entryShift;
    return (bi & clearMask) | newBits;
  }

  return new Proxy(
    { length } as { length: number },
    {
      // ── Read ───────────────────────────────────────────────────────
      get(_target, prop, receiver) {
        // Numeric index
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = Number(prop);
          if (idx < 0 || idx >= length) return undefined;
          return readEntry(getBigint(), idx);
        }

        // Symbol.iterator
        if (prop === Symbol.iterator) {
          const len = length;
          return function* () {
            const bi = getBigint();
            for (let i = 0; i < len; i++) {
              yield readEntry(bi, i);
            }
          };
        }

        // .set()
        if (prop === 'set') {
          return function (arrayLike: ArrayLike<number> | Iterable<number>) {
            let bi = getBigint();
            let i = 0;
            for (const val of Array.from(arrayLike)) {
              if (i >= length) break;
              bi = writeEntry(bi, i, val);
              i++;
            }
            setBigint(bi);
          };
        }

        // .length
        if (prop === 'length') return length;

        // Symbol.toStringTag for console output
        if (prop === Symbol.toStringTag) return 'CubeAdapter';

        // Pass through anything else
        return Reflect.get(_target, prop, receiver);
      },

      // ── Write ──────────────────────────────────────────────────────
      set(_target, prop, value) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = Number(prop);
          if (idx < 0 || idx >= length) return true;
          const bi = writeEntry(getBigint(), idx, value);
          setBigint(bi);
          return true;
        }
        if (prop === 'length') return true; // silently ignore
        return Reflect.set(_target, prop, value);
      },

      // ── Property enumeration ───────────────────────────────────────
      has(_target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = Number(prop);
          return idx >= 0 && idx < length;
        }
        if (prop === 'length') return true;
        return Reflect.has(_target, prop);
      },

      ownKeys() {
        return [...indices.map(String), 'length'];
      },

      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = Number(prop);
          if (idx >= 0 && idx < length) {
            return {
              enumerable: true,
              configurable: true,
            };
          }
          return undefined;
        }
        if (prop === 'length') {
          return { enumerable: false, configurable: true };
        }
        return Reflect.getOwnPropertyDescriptor(_target, prop);
      },
    },
  );
}

// ── Factory functions ──────────────────────────────────────────────────────

export function createCornerPermAdapter(cube: CubeStateInternal): CubeAdapter {
  return createAdapter(
    { field: 'corners', length: 8, valueMask: 0b111n, bitOffset: 0n },
    cube,
  ) as unknown as CubeAdapter;
}

export function createCornerOrientAdapter(cube: CubeStateInternal): CubeAdapter {
  return createAdapter(
    { field: 'corners', length: 8, valueMask: 0b11n, bitOffset: 3n },
    cube,
  ) as unknown as CubeAdapter;
}

export function createEdgePermAdapter(cube: CubeStateInternal): CubeAdapter {
  return createAdapter(
    { field: 'edges', length: 12, valueMask: 0b1111n, bitOffset: 0n },
    cube,
  ) as unknown as CubeAdapter;
}

export function createEdgeOrientAdapter(cube: CubeStateInternal): CubeAdapter {
  return createAdapter(
    { field: 'edges', length: 12, valueMask: 0b1n, bitOffset: 4n },
    cube,
  ) as unknown as CubeAdapter;
}
