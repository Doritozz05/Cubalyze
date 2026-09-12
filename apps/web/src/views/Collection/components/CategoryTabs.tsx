"use client";

/**
 * CategoryTabs.tsx — the outer level, as a horizontal tab bar.
 *
 * Replaces the nested sidebar tree: categories are peers, so they read best as
 * a single roomy row that scrolls sideways. Navigation only — creating and
 * editing categories lives in the manager dialog, which keeps these tabs clean
 * and uncrowded.
 */

import { useTranslation } from "react-i18next";
import { Layers, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryIcon } from "../collectionIcons";
import {
  countItemsInCategory,
  type CollectionSelection,
  type CollectionState,
} from "../collectionModel";

export interface CategoryTabsProps {
  state: CollectionState;
  selection: CollectionSelection;
  onSelect: (selection: CollectionSelection) => void;
  onAdd: () => void;
  onManage: () => void;
}

export function CategoryTabs({
  state,
  selection,
  onSelect,
  onAdd,
  onManage,
}: CategoryTabsProps) {
  const { t } = useTranslation("collection");

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tab
          active={selection.categoryId === null}
          icon={<Layers className="size-3.5" />}
          label={t("nav.everything")}
          count={state.items.length}
          onClick={() => onSelect({ categoryId: null, typeId: null })}
        />

        {state.categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          return (
            <Tab
              key={category.id}
              active={selection.categoryId === category.id}
              icon={
                <Icon
                  className="size-3.5"
                  style={category.accent ? { color: category.accent } : undefined}
                />
              }
              label={category.name}
              count={countItemsInCategory(state, category.id)}
              onClick={() => onSelect({ categoryId: category.id, typeId: null })}
            />
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.75rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">{t("nav.newCategory")}</span>
        </button>
        <button
          type="button"
          onClick={onManage}
          aria-label={t("nav.manageCategories")}
          title={t("nav.manageCategories")}
          className="flex size-8 items-center justify-center rounded-full border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Settings2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Tab({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
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
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.78rem] transition-colors",
        active
          ? "border-transparent bg-ink font-medium text-canvas"
          : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <span className={active ? "text-canvas" : "text-ink-3"}>{icon}</span>
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          "tabular-nums text-[0.68rem]",
          active ? "text-canvas/70" : "text-ink-3",
        )}
      >
        {count}
      </span>
    </button>
  );
}
