import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import type { Algorithm, AlgorithmViewPreferences } from '@cubalyze/algorithm-db';

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

/**
 * One-time migration for custom algorithms saved before viewPreferences.
 * Legacy fields remain readable for rollback compatibility, but all current
 * consumers use the normalized viewPreferences object.
 */
function migrateAlgorithmViewPreferences(algorithm: Algorithm): Algorithm {
  const legacyCamera = algorithm.customViewAngle
    ? {
        theta: algorithm.customViewAngle[0],
        phi: algorithm.customViewAngle[1],
        radius: algorithm.customViewAngle[2],
      }
    : undefined;
  const legacyDiagramRotation = algorithm.customDiagramRotation;
  const current = algorithm.viewPreferences;

  // Merge by field: normalized preferences always win over legacy fields.
  const viewPreferences: AlgorithmViewPreferences = {
    camera: current?.camera ?? legacyCamera,
    diagramRotation: current?.diagramRotation ?? legacyDiagramRotation,
    preferredF2LSlot: current?.preferredF2LSlot,
  };

  return { ...algorithm, viewPreferences };
}

function migratePersistedState(persistedState: unknown): Partial<AlgorithmStoreState> {
  if (!persistedState || typeof persistedState !== 'object') return {};
  const state = persistedState as Partial<AlgorithmStoreState>;
  const customAlgorithms = Object.fromEntries(
    Object.entries(state.customAlgorithms ?? {}).map(([id, algorithm]) => [
      id,
      migrateAlgorithmViewPreferences(algorithm),
    ]),
  );
  return {
    customAlgorithms,
    caseOrder: state.caseOrder ?? {},
  };
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
        version: 2,
        migrate: (persistedState) => migratePersistedState(persistedState),
        partialize: (state) => ({
          customAlgorithms: state.customAlgorithms,
          caseOrder: state.caseOrder,
        }),
      },
    ),
  );
};

export const algorithmStore = createAlgorithmStore();
