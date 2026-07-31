import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import type { Algorithm } from '@cubeforge/algorithm-db';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AlgorithmStoreState {
  /** User-created custom algorithms keyed by their ID for O(1) lookup. */
  customAlgorithms: Record<string, Algorithm>;

  /**
   * Per-case algorithm order override.
   * Maps caseId → ordered array of algorithm IDs (seed + custom).
   * The first ID in the array is the "primary" algorithm for that case.
   * IDs not listed fall back to their natural seed sort order after the listed ones.
   */
  caseOrder: Record<string, string[]>;
}

export interface AlgorithmStoreActions {
  /** Add a new custom algorithm to a case. Returns the created algorithm. */
  addCustomAlgorithm: (alg: Algorithm) => void;

  /** Update an existing custom algorithm's fields. */
  updateCustomAlgorithm: (
    id: string,
    updates: Partial<Algorithm>,
  ) => void;

  /** Delete a custom algorithm by ID. */
  removeCustomAlgorithm: (id: string) => void;

  /** Set the full algorithm order for a case. */
  setCaseOrder: (caseId: string, algorithmIds: string[]) => void;

  /** Move an algorithm within a case's order to a new index. */
  moveAlgorithm: (caseId: string, algorithmId: string, toIndex: number) => void;

  /** Get the ordered algorithm IDs for a case (combining seed + custom). */
  getOrderedIds: (caseId: string, seedAlgorithmIds: string[]) => string[];
}

export type AlgorithmStore = AlgorithmStoreState & AlgorithmStoreActions;

// ─── Helpers ────────────────────────────────────────────────────────────

function ensureCaseOrder(
  state: AlgorithmStoreState,
  caseId: string,
): string[] {
  return state.caseOrder[caseId] ?? [];
}

// ─── Store ──────────────────────────────────────────────────────────────

export const createAlgorithmStore = () => {
  return createStore<AlgorithmStore>()(
    persist(
      (set, get) => ({
        customAlgorithms: {},
        caseOrder: {},

        // ── CRUD ──────────────────────────────────────────────────

        addCustomAlgorithm: (alg) =>
          set((s) => {
            const current = ensureCaseOrder(s, alg.caseId);
            // Prevent duplicate IDs in case order
            const next = current.includes(alg.id)
              ? current
              : [...current, alg.id];
            return {
              customAlgorithms: {
                ...s.customAlgorithms,
                [alg.id]: { ...alg, isCustom: true },
              },
              caseOrder: {
                ...s.caseOrder,
                [alg.caseId]: next,
              },
            };
          }),

        updateCustomAlgorithm: (id, updates) =>
          set((s) => {
            const existing = s.customAlgorithms[id];
            if (!existing) return s;
            return {
              customAlgorithms: {
                ...s.customAlgorithms,
                [id]: { ...existing, ...updates },
              },
            };
          }),

        removeCustomAlgorithm: (id) =>
          set((s) => {
            const alg = s.customAlgorithms[id];
            if (!alg) return s;

            const { [id]: _removed, ...restCustom } = s.customAlgorithms;

            // Remove from caseOrder
            const caseOrder = { ...s.caseOrder };
            if (caseOrder[alg.caseId]) {
              caseOrder[alg.caseId] = caseOrder[alg.caseId].filter(
                (aid) => aid !== id,
              );
              if (caseOrder[alg.caseId].length === 0) {
                delete caseOrder[alg.caseId];
              }
            }

            return {
              customAlgorithms: restCustom,
              caseOrder,
            };
          }),

        // ── Ordering ──────────────────────────────────────────────

        setCaseOrder: (caseId, algorithmIds) =>
          set((s) => ({
            caseOrder: {
              ...s.caseOrder,
              [caseId]: algorithmIds,
            },
          })),

        moveAlgorithm: (caseId, algorithmId, toIndex) =>
          set((s) => {
            const current = ensureCaseOrder(s, caseId);
            const idx = current.indexOf(algorithmId);
            if (idx === -1) return s;

            const next = [...current];
            next.splice(idx, 1);
            next.splice(toIndex, 0, algorithmId);

            return {
              caseOrder: {
                ...s.caseOrder,
                [caseId]: next,
              },
            };
          }),

        // ── Query ─────────────────────────────────────────────────

        getOrderedIds: (caseId, seedAlgorithmIds) => {
          const state = get();
          const order = ensureCaseOrder(state, caseId);

          // Start with the explicitly ordered IDs
          const seen = new Set<string>();
          const result: string[] = [];

          for (const id of order) {
            seen.add(id);
            result.push(id);
          }

          // Append remaining seed IDs not yet in the order list
          for (const id of seedAlgorithmIds) {
            if (!seen.has(id)) {
              seen.add(id);
              result.push(id);
            }
          }

          // Append custom alg IDs not in the order list
          for (const id of Object.keys(state.customAlgorithms)) {
            const alg = state.customAlgorithms[id];
            if (alg.caseId === caseId && !seen.has(id)) {
              seen.add(id);
              result.push(id);
            }
          }

          return result;
        },
      }),
      {
        name: 'cubeforge:custom-algs',
        version: 1,
        partialize: (state) => ({
          customAlgorithms: state.customAlgorithms,
          caseOrder: state.caseOrder,
        }),
      },
    ),
  );
};

export const algorithmStore = createAlgorithmStore();
