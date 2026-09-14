"use client";

/**
 * ItemGrid.tsx — the locker wall.
 *
 * A single responsive grid (`auto-fill`) that scrolls vertically inside its own
 * box. No camera motion, no depth: the gear is the reward, not the transition
 * between it.
 */

import { ItemCard } from "./ItemCard";
import {
  categoryOf,
  cubeOrderFor,
  typeOf,
  type CollectionState,
  type GearItem,
} from "../collectionModel";
import { useCubeUsage } from "../useCubeStats";

export interface ItemGridProps {
  items: readonly GearItem[];
  state: CollectionState;
  selectedId: string | null;
  locale: string;
  onSelect: (item: GearItem) => void;
  onToggleFavorite: (item: GearItem) => void;
  empty: React.ReactNode;
}

export function ItemGrid({
  items,
  state,
  selectedId,
  locale,
  onSelect,
  onToggleFavorite,
  empty,
}: ItemGridProps) {
  // One grouped query for the whole wall, not one per card. The hook sits
  // above the early return so the hook order never depends on the list.
  const usage = useCubeUsage();

  if (items.length === 0) return <>{empty}</>;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))" }}
    >
      {items.map((item) => {
        const type = typeOf(state, item.typeId);
        return (
          <ItemCard
            key={item.id}
            item={item}
            category={categoryOf(state, item.categoryId)}
            typeName={type?.name}
            cubeOrder={cubeOrderFor(type?.puzzleCategory)}
            selected={item.id === selectedId}
            solveCount={usage.get(item.id)?.count}
            locale={locale}
            onSelect={() => onSelect(item)}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        );
      })}
    </div>
  );
}
