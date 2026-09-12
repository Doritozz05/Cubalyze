"use client";

/**
 * TypeChips.tsx — the inner level, as a horizontal chip row.
 *
 * Shown only once a category is selected, so "Cubos" shows cube types, "Lubes"
 * shows lube types, and a brand-new category shows just the empty hint. Adding
 * and renaming types happens in the manager dialog, never inline here — that is
 * what made the old tree feel cramped.
 */

import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countItemsInCategory,
  countItemsInType,
  type CollectionCategory,
  type CollectionSelection,
  type CollectionState,
} from "../collectionModel";

export interface TypeChipsProps {
  state: CollectionState;
  category: CollectionCategory;
  selection: CollectionSelection;
  onSelect: (selection: CollectionSelection) => void;
  onManage: () => void;
}

export function TypeChips({
  state,
  category,
  selection,
  onSelect,
  onManage,
}: TypeChipsProps) {
  const { t } = useTranslation("collection");
  const types = state.types.filter((type) => type.categoryId === category.id);
  const allCount = countItemsInCategory(state, category.id);
  const orphanCount = state.items.filter(
    (item) => item.categoryId === category.id && item.typeId === null,
  ).length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={selection.typeId === null}
          label={t("nav.allTypes")}
          count={allCount}
          onClick={() => onSelect({ categoryId: category.id, typeId: null })}
        />

        {types.map((type) => (
          <Chip
            key={type.id}
            active={selection.typeId === type.id}
            label={type.name}
            count={countItemsInType(state, type.id)}
            onClick={() => onSelect({ categoryId: category.id, typeId: type.id })}
          />
        ))}

        {types.length === 0 ? (
          <span className="shrink-0 pl-1 text-[0.72rem] text-ink-3">
            {t("nav.noTypes")}
            {orphanCount > 0 ? ` · ${t("nav.uncategorisedCount", { count: orphanCount })}` : ""}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[0.72rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Settings2 className="size-3.5" />
        {t("nav.manageTypes")}
      </button>
    </div>
  );
}

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.74rem] transition-colors",
        active
          ? "bg-surface-2 font-medium text-ink ring-1 ring-line-2"
          : "text-ink-3 hover:bg-surface-2/70 hover:text-ink",
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span className="tabular-nums text-[0.66rem] opacity-70">{count}</span>
    </button>
  );
}
