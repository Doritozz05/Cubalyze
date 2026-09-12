"use client";

/**
 * MobileCollectionNav.tsx — the touch taxonomy navigator.
 *
 * Desktop shows categories as a tab bar with a type chip row underneath. On a
 * phone that is two stacked scroll regions eating a third of the screen before
 * a single item is visible, so touch collapses both levels into **one path
 * bar** that opens a drill-down sheet — the same navigation model the
 * Algorithms view uses for its method tree.
 *
 *   ┌──────────────────────────────┐
 *   │ 🗂 Cubes › 3×3            ▾ │   tap →
 *   └──────────────────────────────┘
 *
 * The sheet shows one level at a time (Everything → category → its types), with
 * the create/manage actions pinned to the bottom, so the taxonomy stays fully
 * editable without a single inline button on the main screen.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, Check, FolderTree, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TouchPanel } from "@/components/TouchPanel";
import { categoryIcon } from "../collectionIcons";
import {
  countItemsInCategory,
  countItemsInType,
  taxonomyPath,
  type CollectionSelection,
  type CollectionState,
} from "../collectionModel";

export interface MobileCollectionNavProps {
  state: CollectionState;
  selection: CollectionSelection;
  onSelect: (selection: CollectionSelection) => void;
  onNewCategory: () => void;
  onManageCategories: () => void;
  onManageTypes: () => void;
  className?: string;
}

export function MobileCollectionNav({
  state,
  selection,
  onSelect,
  onNewCategory,
  onManageCategories,
  onManageTypes,
  className,
}: MobileCollectionNavProps) {
  const { t } = useTranslation("collection");
  const [open, setOpen] = useState(false);
  /** `null` = the root list; otherwise the category whose types we are in. */
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const path = taxonomyPath(state, selection);
  const barLabel = path.length > 0 ? path.map((node) => node.label).join(" › ") : t("nav.everything");

  const openCategory = state.categories.find((category) => category.id === openCategoryId) ?? null;

  // Always re-enter at the level that holds the current selection.
  useEffect(() => {
    if (open) setOpenCategoryId(selection.categoryId);
  }, [open, selection.categoryId]);

  const pick = (next: CollectionSelection) => {
    onSelect(next);
    setOpen(false);
  };

  const closeThen = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-glass-panel
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-left shadow-xs touch-manipulation select-none"
      >
        <FolderTree className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium text-ink">
          {barLabel}
        </span>
        <span
          aria-hidden
          className="shrink-0 tabular-nums text-[0.68rem] text-ink-3"
        >
          {countFor(state, selection)}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-3" />
      </button>

      <TouchPanel
        open={open}
        onOpenChange={setOpen}
        title={openCategory ? openCategory.name : t("mobile.navTitle")}
      >
        {/* ── Breadcrumb ───────────────────────────────────────────────── */}
        {openCategory ? (
          <div className="mb-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpenCategoryId(null)}
              aria-label={t("mobile.back")}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors active:bg-surface-2 touch-manipulation"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="truncate text-[0.72rem] text-ink-3">{t("nav.everything")}</span>
            <span className="text-[0.72rem] text-ink-3">›</span>
            <span className="truncate rounded-lg bg-ink px-2.5 py-1.5 text-[0.72rem] font-medium text-canvas">
              {openCategory.name}
            </span>
          </div>
        ) : null}

        {/* ── Level list ───────────────────────────────────────────────── */}
        <div className="flex flex-col">
          {openCategory ? (
            <>
              <Row
                label={t("nav.allTypes")}
                count={countItemsInCategory(state, openCategory.id)}
                selected={selection.categoryId === openCategory.id && !selection.typeId}
                onClick={() => pick({ categoryId: openCategory.id, typeId: null })}
              />
              {typesOf(state, openCategory.id).map((type) => (
                <Row
                  key={type.id}
                  label={type.name}
                  count={countItemsInType(state, type.id)}
                  selected={selection.typeId === type.id}
                  onClick={() => pick({ categoryId: openCategory.id, typeId: type.id })}
                />
              ))}
              {typesOf(state, openCategory.id).length === 0 ? (
                <p className="px-3 py-4 text-center text-[0.72rem] text-ink-3">{t("nav.noTypes")}</p>
              ) : null}
            </>
          ) : (
            <>
              <Row
                label={t("nav.everything")}
                count={state.items.length}
                selected={selection.categoryId === null}
                icon={<FolderTree className="size-4" />}
                onClick={() => pick({ categoryId: null, typeId: null })}
              />
              {state.categories.map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <Row
                    key={category.id}
                    label={category.name}
                    count={countItemsInCategory(state, category.id)}
                    hint={t("manage.typeCount", { count: typesOf(state, category.id).length })}
                    selected={selection.categoryId === category.id}
                    icon={
                      <Icon
                        className="size-4"
                        style={category.accent ? { color: category.accent } : undefined}
                      />
                    }
                    onClick={() => setOpenCategoryId(category.id)}
                    trailing={<ChevronRight className="size-4 shrink-0 text-ink-3" />}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* ── Editing the taxonomy stays one tap away ───────────────────── */}
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          {openCategory ? (
            <Action
              icon={<Settings2 className="size-4" />}
              label={t("nav.manageTypes")}
              onClick={() => {
                // The manager edits the *selected* category, so narrow the view
                // to the one being managed first.
                onSelect({ categoryId: openCategory.id, typeId: null });
                closeThen(onManageTypes);
              }}
            />
          ) : (
            <>
              <Action
                icon={<Plus className="size-4" />}
                label={t("nav.newCategory")}
                onClick={() => closeThen(onNewCategory)}
              />
              <Action
                icon={<Settings2 className="size-4" />}
                label={t("nav.manageCategories")}
                onClick={() => closeThen(onManageCategories)}
              />
            </>
          )}
        </div>
      </TouchPanel>
    </div>
  );
}

function typesOf(state: CollectionState, categoryId: string) {
  return state.types.filter((type) => type.categoryId === categoryId);
}

/** Item count behind the current selection — the bar's right-hand number. */
function countFor(state: CollectionState, selection: CollectionSelection): number {
  if (selection.typeId) return countItemsInType(state, selection.typeId);
  if (selection.categoryId) return countItemsInCategory(state, selection.categoryId);
  return state.items.length;
}

function Row({
  label,
  count,
  hint,
  icon,
  trailing,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  hint?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors touch-manipulation active:bg-surface-2",
        selected ? "bg-surface-2" : "hover:bg-surface-2",
      )}
    >
      {icon ? <span className="grid size-6 shrink-0 place-items-center text-ink-3">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8rem] font-medium text-ink">{label}</span>
        {hint ? <span className="block truncate text-[0.66rem] text-ink-3">{hint}</span> : null}
      </span>
      <span className="shrink-0 tabular-nums text-[0.68rem] text-ink-3">{count}</span>
      {trailing ?? (selected ? <Check className="size-4 shrink-0 text-ink" /> : null)}
    </button>
  );
}

function Action({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 text-left text-[0.78rem] font-medium text-ink transition-colors active:bg-surface-2 touch-manipulation"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-3">
        {icon}
      </span>
      {label}
    </button>
  );
}
