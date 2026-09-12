"use client";

/**
 * CollectionTouchLayout.tsx — the Locker on a phone (<768px).
 *
 * The desktop shell does not survive a 390px viewport: a wrapped header, a
 * two-row taxonomy tab bar, a status/sort toolbar that overflows sideways, a
 * tag cloud and an `auto-fill` grid that lands on **one** 176px column. So the
 * touch layout is a different composition of the same pieces, built on the
 * patterns the rest of the app already uses:
 *
 *   ┌ control strip (fixed) ───────────────────────────────┐
 *   │ [search field, when open]                            │
 *   │ [🗂 Cubes › 3×3 ▾]        [🔍] [☰ Filters ②]          │
 *   │ [All][Owned][Wishlist][Sold][Lent]  → horizontal      │
 *   └──────────────────────────────────────────────────────┘
 *   ┌ scroll area (the only scroll surface) ───────────────┐
 *   │ Locker · 12 items                                    │
 *   │  ┌────────┐ ┌────────┐   2 columns, compact cards     │
 *   └──────────────────────────────────────────────────────┘
 *                                       ( + )  floating CTA
 *
 * Tapping a card opens the product page as a full-screen overlay with a back
 * bar and a sticky footer (the same master-detail move the Algorithms and
 * Insights views make on touch). Filters that are occasional — sort order,
 * favourites, the tag vocabulary — move into a sheet; only status keeps a
 * permanent row, because it is the question people actually ask.
 *
 * Nothing here hides behind hover: a finger has none.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Package, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import { ItemCard } from "./ItemCard";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { MobileCollectionFilters } from "./MobileCollectionFilters";
import { MobileCollectionNav } from "./MobileCollectionNav";
import {
  ITEM_STATUS_FILTERS,
  STATUS_FILTER_I18N_KEY,
  categoryOf,
  countActiveFilters,
  cubeOrderFor,
  typeOf,
  type CollectionSelection,
  type CollectionState,
  type GearItem,
  type ItemSort,
  type ItemStatus,
} from "../collectionModel";

export interface CollectionTouchProps {
  state: CollectionState;
  /** Already filtered and sorted by the view. */
  items: readonly GearItem[];
  hydrated: boolean;
  locale: string;

  selection: CollectionSelection;
  onSelectionChange: (selection: CollectionSelection) => void;

  selectedItem: GearItem | null;
  onSelectItem: (item: GearItem) => void;
  onCloseItem: () => void;

  query: string;
  onQueryChange: (query: string) => void;
  status: ItemStatus | "all";
  onStatusChange: (status: ItemStatus | "all") => void;
  sort: ItemSort;
  onSortChange: (sort: ItemSort) => void;
  tagFacets: readonly { tag: string; count: number }[];
  activeTags: readonly string[];
  onToggleTag: (tag: string) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  onClearFilters: () => void;

  onNewCategory: () => void;
  onManageCategories: () => void;
  onManageTypes: () => void;
  /** Backup and restore, one tap away — a phone has no other way in. */
  onExport: () => void;
  onImport: () => void;

  onAddItem: () => void;
  onEditItem: (item: GearItem) => void;
  onDeleteItem: (item: GearItem) => void;
  onTogglePrimary: (item: GearItem) => void;
  onToggleFavorite: (item: GearItem) => void;
}

export function CollectionTouchLayout(props: CollectionTouchProps) {
  const {
    state,
    items,
    hydrated,
    locale,
    selection,
    onSelectionChange,
    selectedItem,
    onSelectItem,
    onCloseItem,
    query,
    onQueryChange,
    status,
    onStatusChange,
    sort,
    onSortChange,
    tagFacets,
    activeTags,
    onToggleTag,
    favoritesOnly,
    onToggleFavorites,
    onClearFilters,
    onNewCategory,
    onManageCategories,
    onManageTypes,
    onExport,
    onImport,
    onAddItem,
    onEditItem,
    onDeleteItem,
    onTogglePrimary,
    onToggleFavorite,
  } = props;

  const { t } = useTranslation("collection");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterCount = countActiveFilters({ status, tags: activeTags, favoritesOnly });

  // The product page needs the item's place in the taxonomy; resolve it here so
  // the view only hands down the item itself.
  const detailCategory = selectedItem ? categoryOf(state, selectedItem.categoryId) : undefined;
  const detailType = selectedItem ? typeOf(state, selectedItem.typeId) : undefined;

  const headings = useMemo(
    () => ({
      isCube: detailCategory?.kind === "cube",
      cubeOrder: cubeOrderFor(detailType?.puzzleCategory),
    }),
    [detailCategory?.kind, detailType?.puzzleCategory],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ── Control strip: navigation, search, filters ─────────────────── */}
      <div className="shrink-0 space-y-2 px-3 pb-2.5 pt-2">
        <AnimatePresence initial={false}>
          {searchOpen ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[0.8rem] text-ink outline-none transition-colors placeholder:text-ink-3/60 focus:border-ink-2 touch-manipulation"
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <MobileCollectionNav
            className="min-w-0 flex-1"
            state={state}
            selection={selection}
            onSelect={onSelectionChange}
            onNewCategory={onNewCategory}
            onManageCategories={onManageCategories}
            onManageTypes={onManageTypes}
            onExport={onExport}
            onImport={onImport}
          />

          <button
            type="button"
            onClick={() => {
              // Closing the field must not leave an invisible query filtering
              // the wall — the search box is the only sign it exists.
              if (searchOpen) onQueryChange("");
              setSearchOpen(!searchOpen);
            }}
            aria-pressed={searchOpen}
            aria-label={searchOpen ? t("mobile.closeSearch") : t("searchPlaceholder")}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-3 transition-colors active:bg-surface-2 touch-manipulation"
          >
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </button>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={t("mobile.filters")}
            className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-3 transition-colors active:bg-surface-2 touch-manipulation"
          >
            <SlidersHorizontal className="size-4" />
            {filterCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-ink text-[0.55rem] font-semibold tabular-nums text-canvas">
                {filterCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Status is the one filter worth a permanent row. */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ITEM_STATUS_FILTERS.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={status === entry}
              onClick={() => onStatusChange(entry)}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[0.74rem] transition-colors touch-manipulation",
                status === entry
                  ? "bg-ink font-medium text-canvas"
                  : "border border-line text-ink-3 active:text-ink",
              )}
            >
              {t(STATUS_FILTER_I18N_KEY[entry])}
            </button>
          ))}
        </div>
      </div>

      {/* ── The wall: the only scroll surface ──────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-24">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{t("title")}</h1>
          <span className="shrink-0 tabular-nums text-[0.68rem] text-ink-3">
            {t("results", { count: items.length })}
          </span>
        </div>

        {!hydrated ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[0.72] w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyTouch
            hasItems={state.items.length > 0}
            canAdd={state.categories.length > 0}
            onAdd={onAddItem}
            onClear={onClearFilters}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {items.map((item) => {
              const category = categoryOf(state, item.categoryId);
              const type = typeOf(state, item.typeId);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  category={category}
                  typeName={type?.name}
                  cubeOrder={cubeOrderFor(type?.puzzleCategory)}
                  selected={item.id === selectedItem?.id}
                  compact
                  locale={locale}
                  onSelect={() => onSelectItem(item)}
                  onTogglePrimary={() => onTogglePrimary(item)}
                  onToggleFavorite={() => onToggleFavorite(item)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Primary action: always within thumb reach ───────────────────── */}
      <button
        type="button"
        disabled={state.categories.length === 0}
        onClick={() => {
          hapticTap();
          onAddItem();
        }}
        aria-label={t("addItem")}
        className={cn(
          "absolute bottom-4 right-4 grid size-14 place-items-center rounded-full shadow-lg transition-transform touch-manipulation",
          state.categories.length === 0
            ? "bg-surface-2 text-ink-3"
            : "bg-ink text-canvas active:scale-95",
        )}
      >
        <Plus className="size-6" />
      </button>

      <MobileCollectionFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        sort={sort}
        onSortChange={onSortChange}
        favoritesOnly={favoritesOnly}
        onToggleFavorites={onToggleFavorites}
        tagFacets={tagFacets}
        activeTags={activeTags}
        onToggleTag={onToggleTag}
        onClear={onClearFilters}
        activeCount={filterCount}
      />

      {/* ── Product page as a full-screen overlay ──────────────────────── */}
      <AnimatePresence>
        {selectedItem ? (
          <motion.div
            key="locker-item-detail"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-0 z-50 flex flex-col bg-surface"
          >
            <ItemDetailPanel
              variant="overlay"
              item={selectedItem}
              isCube={headings.isCube}
              cubeOrder={headings.cubeOrder}
              categoryIconId={detailCategory?.icon}
              typeName={detailType?.name}
              categoryName={detailCategory?.name}
              locale={locale}
              onEdit={() => onEditItem(selectedItem)}
              onDelete={() => onDeleteItem(selectedItem)}
              onTogglePrimary={() => onTogglePrimary(selectedItem)}
              onToggleFavorite={() => onToggleFavorite(selectedItem)}
              onClose={onCloseItem}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function EmptyTouch({
  hasItems,
  canAdd,
  onAdd,
  onClear,
}: {
  hasItems: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("collection");
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Package className="size-5 text-ink-3" />
      <p className="text-sm font-medium text-ink-2">{hasItems ? t("emptyFiltered") : t("empty")}</p>
      <p className="max-w-xs text-[0.75rem] text-ink-3">
        {hasItems ? t("emptyFilteredHint") : t("emptyHint")}
      </p>
      <div className="mt-2 flex gap-2">
        {hasItems ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            {t("filters.clear")}
          </Button>
        ) : null}
        {canAdd && !hasItems ? (
          <Button size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="size-3.5" />
            {t("addItem")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
