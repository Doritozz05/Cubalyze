"use client";

/**
 * ItemGrid.tsx — the locker wall.
 *
 * A single responsive grid (`auto-fill`, 168px min) that scrolls vertically
 * inside its own box. No camera motion, no depth: the products are the reward,
 * not the transition between them.
 */

import { ItemCard } from "./ItemCard";
import { categoryOf, typeOf, type CollectionState, type GearItem } from "../collectionModel";

export interface ItemGridProps {
  items: readonly GearItem[];
  state: CollectionState;
  selectedId: string | null;
  locale: string;
  onSelect: (item: GearItem) => void;
  onTogglePrimary: (item: GearItem) => void;
  onToggleFavorite: (item: GearItem) => void;
  empty: React.ReactNode;
}

export function ItemGrid({
  items,
  state,
  selectedId,
  locale,
  onSelect,
  onTogglePrimary,
  onToggleFavorite,
  empty,
}: ItemGridProps) {
  if (items.length === 0) return <>{empty}</>;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}
    >
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isCube={categoryOf(state, item.categoryId)?.kind === "cube"}
          typeName={typeOf(state, item.typeId)?.name}
          selected={item.id === selectedId}
          locale={locale}
          onSelect={() => onSelect(item)}
          onTogglePrimary={() => onTogglePrimary(item)}
          onToggleFavorite={() => onToggleFavorite(item)}
        />
      ))}
    </div>
  );
}
