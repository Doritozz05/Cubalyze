"use client";

/**
 * TaxonomyPanel.tsx — the two-level navigation for the Locker.
 *
 * Outer level: **categories** (Cubos, Lubes, Gear, …). Inner level: **types**
 * (3×3, 2×2, Pyraminx …). Selecting a node filters the grid; "Everything" at
 * the top clears the filter.
 *
 * Every node carries its own manage affordances (edit / delete / add type), so
 * creating the taxonomy never requires leaving the panel. Cube categories also
 * expose the app-category **exclusions** (OH out of the box) because their
 * types are mirrored from the timer's puzzle selector.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Layers, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { categoryIcon } from "../collectionIcons";
import {
  countItemsInCategory,
  countItemsInType,
  type CollectionCategory,
  type CollectionSelection,
  type CollectionState,
  type CollectionType,
} from "../collectionModel";

export interface TaxonomyPanelProps {
  state: CollectionState;
  selection: CollectionSelection;
  onSelect: (selection: CollectionSelection) => void;
  onAddCategory: () => void;
  onEditCategory: (category: CollectionCategory) => void;
  onDeleteCategory: (category: CollectionCategory) => void;
  onAddType: (categoryId: string) => void;
  onEditType: (type: CollectionType) => void;
  onDeleteType: (type: CollectionType) => void;
  onManageExclusions: () => void;
  onSyncCategory: (categoryId: string) => void;
}

export function TaxonomyPanel({
  state,
  selection,
  onSelect,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddType,
  onEditType,
  onDeleteType,
  onManageExclusions,
  onSyncCategory,
}: TaxonomyPanelProps) {
  const { t } = useTranslation("collection");
  const total = state.items.length;
  const everythingSelected = selection.categoryId === null;

  // Group types per category once, so the panel does not re-filter per row.
  const typesByCategory = useMemo(() => {
    const map = new Map<string, CollectionType[]>();
    for (const type of state.types) {
      const list = map.get(type.categoryId);
      if (list) list.push(type);
      else map.set(type.categoryId, [type]);
    }
    return map;
  }, [state.types]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("taxonomy.title")}
        </span>
        <button
          type="button"
          onClick={onAddCategory}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-3" />
          {t("taxonomy.newCategory")}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <NodeButton
          active={everythingSelected}
          label={t("taxonomy.everything")}
          icon={<Layers className="size-3.5" />}
          count={total}
          onClick={() => onSelect({ categoryId: null, typeId: null })}
        />

        {state.categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          const types = typesByCategory.get(category.id) ?? [];
          const categoryActive =
            selection.categoryId === category.id && selection.typeId === null;
          return (
            <div key={category.id} className="space-y-0.5">
              <div className="group flex items-center gap-0.5">
                <NodeButton
                  className="flex-1"
                  active={categoryActive}
                  label={category.name}
                  count={countItemsInCategory(state, category.id)}
                  icon={<Icon className="size-3.5" style={category.accent ? { color: category.accent } : undefined} />}
                  onClick={() => onSelect({ categoryId: category.id, typeId: null })}
                />
                <RowMenu
                  labels={{
                    edit: t("taxonomy.editCategory"),
                    remove: t("taxonomy.deleteCategory"),
                    sync: category.kind === "cube" ? t("taxonomy.syncCubes") : undefined,
                    exclusions: category.kind === "cube" ? t("taxonomy.exclusions") : undefined,
                  }}
                  onEdit={() => onEditCategory(category)}
                  onRemove={() => onDeleteCategory(category)}
                  onSync={category.kind === "cube" ? () => onSyncCategory(category.id) : undefined}
                  onExclusions={category.kind === "cube" ? onManageExclusions : undefined}
                />
              </div>

              <div className="ml-3 space-y-0.5 border-l border-line pl-2">
                {types.map((type) => (
                  <div key={type.id} className="group flex items-center gap-0.5">
                    <NodeButton
                      className="flex-1"
                      active={selection.typeId === type.id}
                      label={type.name}
                      count={countItemsInType(state, type.id)}
                      icon={<ChevronRight className="size-3 text-ink-3" />}
                      onClick={() => onSelect({ categoryId: category.id, typeId: type.id })}
                    />
                    <RowMenu
                      labels={{
                        edit: t("taxonomy.editType"),
                        remove: t("taxonomy.deleteType"),
                      }}
                      onEdit={() => onEditType(type)}
                      onRemove={() => onDeleteType(type)}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => onAddType(category.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[0.72rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Plus className="size-3" />
                  {t("taxonomy.newType")}
                </button>
              </div>
            </div>
          );
        })}
      </nav>

      <p className="px-1 text-[0.66rem] leading-relaxed text-ink-3">{t("taxonomy.hint")}</p>
    </div>
  );
}

function NodeButton({
  active,
  label,
  count,
  icon,
  onClick,
  className,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.78rem] transition-colors",
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
        className,
      )}
    >
      <span className="shrink-0 text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-[0.68rem] text-ink-3">{count}</span>
    </button>
  );
}

function RowMenu({
  labels,
  onEdit,
  onRemove,
  onSync,
  onExclusions,
}: {
  labels: { edit: string; remove: string; sync?: string; exclusions?: string };
  onEdit: () => void;
  onRemove: () => void;
  onSync?: () => void;
  onExclusions?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={labels.edit}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit} className="gap-2 text-[0.78rem]">
          <Pencil className="size-3.5" />
          {labels.edit}
        </DropdownMenuItem>
        {onSync && labels.sync ? (
          <DropdownMenuItem onClick={onSync} className="gap-2 text-[0.78rem]">
            <RefreshCw className="size-3.5" />
            {labels.sync}
          </DropdownMenuItem>
        ) : null}
        {onExclusions && labels.exclusions ? (
          <DropdownMenuItem onClick={onExclusions} className="gap-2 text-[0.78rem]">
            <Layers className="size-3.5" />
            {labels.exclusions}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRemove} variant="destructive" className="gap-2 text-[0.78rem]">
          <Trash2 className="size-3.5" />
          {labels.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
