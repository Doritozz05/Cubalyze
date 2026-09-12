"use client";

/**
 * collectionPersistence.ts — the pure half of "how the Locker reaches SQLite".
 *
 * The store keeps the collection as ONE in-memory object (`CollectionState`) and
 * every edit produces a new one. Persisting is therefore a *diff* problem, not a
 * rewrite: comparing the previous state with the next tells us exactly which
 * categories, types and items to upsert and which to delete.
 *
 * Keeping the diff here (pure, no I/O) matters for two reasons:
 *
 *   • It is the only place that decides what "changed" means, so the answer is
 *     unit-testable without a database.
 *   • It never rewrites untouched rows. A wholesale delete+reinsert would bump
 *     every `updated_at`, which (once the Locker syncs) would push the whole
 *     collection on every keystroke and would fire delete triggers that
 *     fabricate tombstones for rows nobody deleted.
 *
 * Identity is the row id; "changed" is deep equality of the serialised row, which
 * is exactly what the model bumps when an edit is real (`updatedAt`).
 */

import type { CollectionCategory, CollectionState, CollectionType, GearItem } from "./collectionModel";

export interface CollectionDiff {
  categories: { upsert: CollectionCategory[]; remove: string[] };
  types: { upsert: CollectionType[]; remove: string[] };
  items: { upsert: GearItem[]; remove: string[] };
}

function diffRows<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
): { upsert: T[]; remove: string[] } {
  const before = new Map(prev.map((row) => [row.id, row]));
  const upsert: T[] = [];
  const remove: string[] = [];

  for (const row of next) {
    const previous = before.get(row.id);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(row)) upsert.push(row);
  }
  const nextIds = new Set(next.map((row) => row.id));
  for (const row of prev) {
    if (!nextIds.has(row.id)) remove.push(row.id);
  }
  return { upsert, remove };
}

/** What changed between two states (empty diff when nothing did). */
export function diffCollection(prev: CollectionState, next: CollectionState): CollectionDiff {
  return {
    categories: diffRows(prev.categories, next.categories),
    types: diffRows(prev.types, next.types),
    items: diffRows(prev.items, next.items),
  };
}

export function isDiffEmpty(diff: CollectionDiff): boolean {
  return (
    diff.categories.upsert.length === 0 &&
    diff.categories.remove.length === 0 &&
    diff.types.upsert.length === 0 &&
    diff.types.remove.length === 0 &&
    diff.items.upsert.length === 0 &&
    diff.items.remove.length === 0
  );
}

/**
 * Deletes in child-first order. The schema cascades (a category takes its types
 * and items) and re-homes (deleting a type sets its items' `type_id` to NULL),
 * so the order only matters for keeping every statement meaningful instead of
 * relying on a cascade that would hide a mistake.
 */
export function deletionPlan(diff: CollectionDiff): { table: "items" | "types" | "categories"; id: string }[] {
  return [
    ...diff.items.remove.map((id) => ({ table: "items" as const, id })),
    ...diff.types.remove.map((id) => ({ table: "types" as const, id })),
    ...diff.categories.remove.map((id) => ({ table: "categories" as const, id })),
  ];
}

/** Deep value equality for the small string arrays the model carries around. */
export function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
