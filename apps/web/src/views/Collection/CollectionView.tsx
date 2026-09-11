"use client";

/**
 * CollectionView.tsx — the Locker.
 *
 * A catalogue, not a showroom: pick a category (and optionally a type) on the
 * left, scan a flat grid in the middle, read the spec sheet on the right.
 * Everything is created and edited in place (categories, types, items) and
 * persisted to localStorage through `collectionStore`.
 *
 * Deliberate choices:
 *   • No carousel / 3D camera. Selection is contrast; the wall scrolls.
 *   • Background-aware: the view paints no canvas fill, so the theme's custom
 *     background image (Settings → Appearance) shows through, like every other
 *     view. Panels use `bg-surface`, which liquid glass already owns.
 *   • Cube categories expose a "main" flag; gear categories never do.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { toast } from "sonner";
import {
  Download,
  Heart,
  MoreVertical,
  Package,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categoryIcon } from "./collectionIcons";
import { useCollectionStore } from "./collectionStore";
import {
  countByStatus,
  queryItems,
  sortItems,
  tagFacets,
  type CollectionCategory,
  type CollectionSelection,
  type CollectionState,
  type CollectionType,
  type GearItem,
  type ItemSort,
  type ItemStatus,
} from "./collectionModel";
import { TaxonomyPanel } from "./components/TaxonomyPanel";
import { CategoryDialog, ExclusionsDialog, TypeDialog } from "./components/TaxonomyDialogs";
import { ItemEditorDialog } from "./components/ItemEditorDialog";
import { ItemGrid } from "./components/ItemGrid";
import { ItemDetailPanel } from "./components/ItemDetailPanel";

const STATUS_FILTERS: readonly (ItemStatus | "all")[] = ["all", "owned", "wishlist", "sold", "lent"];

/** Status → translation key, including the "all" pseudo-filter. */
const STATUS_LABEL_KEY: Record<ItemStatus | "all", ParseKeys<"collection">> = {
  all: "status.all",
  owned: "status.owned",
  wishlist: "status.wishlist",
  sold: "status.sold",
  lent: "status.lent",
};

const SORTS: readonly { id: ItemSort; labelKey: ParseKeys<"collection"> }[] = [
  { id: "name", labelKey: "sort.name" },
  { id: "recent", labelKey: "sort.recent" },
  { id: "oldest", labelKey: "sort.oldest" },
  { id: "price", labelKey: "sort.price" },
  { id: "rating", labelKey: "sort.rating" },
  { id: "brand", labelKey: "sort.brand" },
];

/** Media-query hook (synchronous first paint, mirrors `use-mobile`). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function CollectionView() {
  const { t, i18n } = useTranslation("collection");

  const data = useCollectionStore((s) => s.data);
  const hydrated = useCollectionStore((s) => s.hydrated);
  const addCategory = useCollectionStore((s) => s.addCategory);
  const updateCategory = useCollectionStore((s) => s.updateCategory);
  const removeCategory = useCollectionStore((s) => s.removeCategory);
  const addType = useCollectionStore((s) => s.addType);
  const updateType = useCollectionStore((s) => s.updateType);
  const removeType = useCollectionStore((s) => s.removeType);
  const addItem = useCollectionStore((s) => s.addItem);
  const updateItem = useCollectionStore((s) => s.updateItem);
  const removeItem = useCollectionStore((s) => s.removeItem);
  const togglePrimary = useCollectionStore((s) => s.togglePrimary);
  const toggleFavorite = useCollectionStore((s) => s.toggleFavorite);
  const setExcluded = useCollectionStore((s) => s.setExcluded);
  const syncCategory = useCollectionStore((s) => s.syncCategory);
  const replaceState = useCollectionStore((s) => s.replaceState);
  const reset = useCollectionStore((s) => s.reset);

  const isDesktopRail = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 1280px)");

  // ── View state ──────────────────────────────────────────────────────────
  const [selection, setSelection] = useState<CollectionSelection>({
    categoryId: null,
    typeId: null,
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ItemStatus | "all">("all");
  const [sort, setSort] = useState<ItemSort>("name");
  const [tags, setTags] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);

  // ── Dialogs ─────────────────────────────────────────────────────────────
  const [itemEditor, setItemEditor] = useState<{ open: boolean; item: GearItem | null }>({
    open: false,
    item: null,
  });
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category: CollectionCategory | null;
  }>({ open: false, category: null });
  const [typeDialog, setTypeDialog] = useState<{
    open: boolean;
    categoryId: string;
    type: CollectionType | null;
  }>({ open: false, categoryId: "", type: null });
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "category"; category: CollectionCategory }
    | { kind: "type"; type: CollectionType }
    | { kind: "item"; item: GearItem }
    | { kind: "reset" }
    | null
  >(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────
  const tagOptions = useMemo(() => tagFacets(data), [data]);
  const statusCounts = useMemo(() => countByStatus(data), [data]);

  const filtered = useMemo(
    () =>
      sortItems(
        queryItems(data, {
          categoryId: selection.categoryId,
          typeId: selection.typeId,
          status,
          tags,
          query,
          favoritesOnly,
        }),
        sort,
      ),
    [data, selection, status, tags, query, favoritesOnly, sort],
  );

  const selectedItem = useMemo(
    () => data.items.find((item) => item.id === selectedItemId) ?? null,
    [data.items, selectedItemId],
  );

  const selectionLabel = useMemo(() => {
    if (!selection.categoryId) return t("taxonomy.everything");
    const category = data.categories.find((c) => c.id === selection.categoryId);
    if (!category) return t("taxonomy.everything");
    if (!selection.typeId) return category.name;
    const type = data.types.find((tp) => tp.id === selection.typeId);
    return type ? `${category.name} / ${type.name}` : category.name;
  }, [selection, data, t]);

  // Drop a selection that points at a deleted node.
  useEffect(() => {
    if (selection.categoryId && !data.categories.some((c) => c.id === selection.categoryId)) {
      setSelection({ categoryId: null, typeId: null });
    } else if (selection.typeId && !data.types.some((tp) => tp.id === selection.typeId)) {
      setSelection((current) => ({ ...current, typeId: null }));
    }
  }, [data.categories, data.types, selection]);

  useEffect(() => {
    if (selectedItemId && !data.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [data.items, selectedItemId]);

  const isCubeSelection = useMemo(() => {
    const category = data.categories.find((c) => c.id === selection.categoryId);
    return category?.kind === "cube";
  }, [data.categories, selection.categoryId]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleSaveItem = useCallback(
    (input: Parameters<typeof addItem>[0]) => {
      if (itemEditor.item) {
        updateItem(itemEditor.item.id, input);
      } else {
        const id = addItem(input);
        setSelectedItemId(id);
      }
    },
    [itemEditor.item, addItem, updateItem],
  );

  const handleSaveCategory = useCallback(
    (draft: { name: string; kind: CollectionCategory["kind"]; icon: string; accent?: string }) => {
      if (categoryDialog.category) {
        updateCategory(categoryDialog.category.id, draft);
      } else {
        const id = addCategory(draft);
        setSelection({ categoryId: id, typeId: null });
      }
    },
    [categoryDialog.category, addCategory, updateCategory],
  );

  const handleSaveType = useCallback(
    (draft: { name: string; puzzleCategory: CollectionType["puzzleCategory"] }) => {
      if (typeDialog.type) {
        updateType(typeDialog.type.id, { ...draft, categoryId: typeDialog.categoryId });
      } else {
        const id = addType({ ...draft, categoryId: typeDialog.categoryId });
        setSelection({ categoryId: typeDialog.categoryId, typeId: id });
      }
    },
    [typeDialog, addType, updateType],
  );

  const handleToggleExclusion = useCallback(
    (category: Parameters<typeof setExcluded>[0][number], include: boolean) => {
      const next = include
        ? data.excludedCategories.filter((entry) => entry !== category)
        : [...data.excludedCategories, category];
      setExcluded(next);
      // Mirror the change into every cube category (empty types only).
      for (const cat of data.categories) {
        if (cat.kind === "cube") syncCategory(cat.id);
      }
    },
    [data.excludedCategories, data.categories, setExcluded, syncCategory],
  );

  const handleExport = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cubeforge-locker-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t("io.exported"));
    } catch {
      toast.error(t("io.exportFailed"));
    }
  }, [data, t]);

  const handleImportFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as CollectionState;
        replaceState(parsed);
        toast.success(t("io.imported"));
      } catch {
        toast.error(t("io.importFailed"));
      }
    },
    [replaceState, t],
  );

  const confirmCopy = useMemo<{
    title: string;
    description: string;
    confirmLabel?: string;
  }>(() => {
    if (!confirm) return { title: "", description: "", confirmLabel: undefined };
    switch (confirm.kind) {
      case "category":
        return {
          title: t("confirm.categoryTitle", { name: confirm.category.name }),
          description: t("confirm.categoryBody"),
          confirmLabel: i18n.t("common:delete"),
        };
      case "type":
        return {
          title: t("confirm.typeTitle", { name: confirm.type.name }),
          description: t("confirm.typeBody"),
          confirmLabel: i18n.t("common:delete"),
        };
      case "item":
        return {
          title: t("confirm.itemTitle", { name: confirm.item.name }),
          description: t("confirm.itemBody"),
          confirmLabel: i18n.t("common:delete"),
        };
      case "reset":
        return {
          title: t("confirm.resetTitle"),
          description: t("confirm.resetBody"),
          confirmLabel: t("confirm.reset"),
        };
    }
  }, [confirm, t]);

  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === "category") {
      removeCategory(confirm.category.id);
      setSelection({ categoryId: null, typeId: null });
    } else if (confirm.kind === "type") {
      removeType(confirm.type.id);
    } else if (confirm.kind === "item") {
      removeItem(confirm.item.id);
      setSelectedItemId(null);
    } else if (confirm.kind === "reset") {
      reset();
      setSelection({ categoryId: null, typeId: null });
      setSelectedItemId(null);
      toast.success(t("io.reset"));
    }
    setConfirm(null);
  }, [confirm, removeCategory, removeType, removeItem, reset, t]);

  const filterCount = (status !== "all" ? 1 : 0) + tags.length + (favoritesOnly ? 1 : 0);
  const clearFilters = () => {
    setStatus("all");
    setTags([]);
    setFavoritesOnly(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const taxonomy = (
    <TaxonomyPanel
      state={data}
      selection={selection}
      onSelect={(next) => {
        setSelection(next);
        setTaxonomyOpen(false);
      }}
      onAddCategory={() => setCategoryDialog({ open: true, category: null })}
      onEditCategory={(category) => setCategoryDialog({ open: true, category })}
      onDeleteCategory={(category) => setConfirm({ kind: "category", category })}
      onAddType={(categoryId) => setTypeDialog({ open: true, categoryId, type: null })}
      onEditType={(type) => setTypeDialog({ open: true, categoryId: type.categoryId, type })}
      onDeleteType={(type) => setConfirm({ kind: "type", type })}
      onManageExclusions={() => setExclusionsOpen(true)}
      onSyncCategory={syncCategory}
    />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ink-3">
            <Package className="size-3.5" />
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]">
              {t("eyebrow")}
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
          <p className="mt-1 max-w-prose text-[0.8rem] text-ink-3">
            {t("summary", {
              total: data.items.length,
              cubes: statusCounts.owned,
              wishlist: statusCounts.wishlist,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-52 rounded-md border border-line bg-surface pl-8 pr-2 text-[0.8rem] text-ink outline-none transition-colors focus:border-line-2 placeholder:text-ink-3"
            />
          </div>
          <Button
            className="gap-1.5"
            onClick={() => setItemEditor({ open: true, item: null })}
            disabled={data.categories.length === 0}
          >
            <Plus className="size-3.5" />
            {t("addItem")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("io.menu")}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleExport} className="gap-2 text-[0.8rem]">
                <Download className="size-3.5" />
                {t("io.export")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => importInputRef.current?.click()}
                className="gap-2 text-[0.8rem]"
              >
                <Upload className="size-3.5" />
                {t("io.import")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirm({ kind: "reset" })}
                className="gap-2 text-[0.8rem]"
              >
                <RotateCcw className="size-3.5" />
                {t("io.reset")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              void handleImportFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        {isDesktopRail ? (
          <aside className="flex w-60 shrink-0 flex-col rounded-lg border border-line bg-surface/80 p-3 backdrop-blur-sm">
            {taxonomy}
          </aside>
        ) : null}

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {!isDesktopRail ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTaxonomyOpen(true)}
                >
                  <SlidersHorizontal className="size-3.5" />
                  {t("taxonomy.title")}
                </Button>
              ) : null}
              {(() => {
                const category = data.categories.find((c) => c.id === selection.categoryId);
                const Icon = category ? categoryIcon(category.icon) : Package;
                return (
                  <span className="flex min-w-0 items-center gap-2 text-[0.8rem] font-medium text-ink">
                    <Icon className="size-3.5 shrink-0 text-ink-3" />
                    <span className="truncate">{selectionLabel}</span>
                    <span className="shrink-0 tabular-nums text-[0.7rem] text-ink-3">
                      {filtered.length}
                    </span>
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-line bg-surface/70 p-0.5">
                {STATUS_FILTERS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={status === entry}
                    onClick={() => setStatus(entry)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.7rem] transition-colors",
                      status === entry ? "bg-surface-2 font-medium text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {t(STATUS_LABEL_KEY[entry])}
                  </button>
                ))}
              </div>

              <Button
                variant={favoritesOnly ? "secondary" : "ghost"}
                size="icon"
                aria-label={t("filters.favorites")}
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((value) => !value)}
              >
                <Heart className={cn("size-4", favoritesOnly && "fill-current")} />
              </Button>

              {filterCount > 0 ? (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
                  <X className="size-3.5" />
                  {t("filters.clear")}
                </Button>
              ) : null}

              <Select value={sort} onValueChange={(value) => setSort(value as ItemSort)}>
                <SelectTrigger size="sm" className="w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {t(entry.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tag filter row */}
          {tagOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="size-3 text-ink-3" />
              {tagOptions.slice(0, 12).map(({ tag, count }) => {
                const active = tags.some((entry) => entry.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setTags((current) =>
                        active
                          ? current.filter((entry) => entry.toLowerCase() !== tag.toLowerCase())
                          : [...current, tag],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[0.68rem] transition-colors",
                      active
                        ? "border-transparent bg-ink text-canvas"
                        : "border-line text-ink-3 hover:text-ink",
                    )}
                  >
                    {tag}
                    <span className="ml-1 tabular-nums opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Grid */}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-surface/60 p-3 backdrop-blur-sm",
            )}
          >
            {!hydrated ? (
              <div className="flex h-full items-center justify-center text-[0.78rem] text-ink-3">
                {t("loading")}
              </div>
            ) : (
              <ItemGrid
                items={filtered}
                state={data}
                selectedId={selectedItemId}
                locale={i18n.language}
                onSelect={(item) => setSelectedItemId(item.id)}
                onTogglePrimary={(item) => togglePrimary(item.id)}
                onToggleFavorite={(item) => toggleFavorite(item.id)}
                empty={
                  <EmptyState
                    hasItems={data.items.length > 0}
                    canAdd={data.categories.length > 0}
                    onAdd={() => setItemEditor({ open: true, item: null })}
                    onClear={clearFilters}
                    isCubeSelection={isCubeSelection}
                  />
                }
              />
            )}
          </div>
        </section>

        {isWide ? (
          <aside className="flex w-[336px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface/80 backdrop-blur-sm">
            {selectedItem ? (
              <ItemDetailPanel
                item={selectedItem}
                isCube={data.categories.find((c) => c.id === selectedItem.categoryId)?.kind === "cube"}
                typeName={data.types.find((tp) => tp.id === selectedItem.typeId)?.name}
                categoryName={data.categories.find((c) => c.id === selectedItem.categoryId)?.name}
                locale={i18n.language}
                onEdit={() => setItemEditor({ open: true, item: selectedItem })}
                onDelete={() => setConfirm({ kind: "item", item: selectedItem })}
                onTogglePrimary={() => togglePrimary(selectedItem.id)}
                onToggleFavorite={() => toggleFavorite(selectedItem.id)}
                onClose={() => setSelectedItemId(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <Package className="size-5 text-ink-3" />
                <p className="text-[0.78rem] text-ink-3">{t("detailPlaceholder")}</p>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {/* ── Mobile overlays ────────────────────────────────────────────── */}
      {!isDesktopRail && taxonomyOpen ? (
        <div className="absolute inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setTaxonomyOpen(false)}
            aria-hidden
          />
          <div className="relative h-full w-72 max-w-[85%] overflow-y-auto border-r border-line bg-surface p-4">
            {taxonomy}
          </div>
        </div>
      ) : null}

      {!isWide && selectedItem ? (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedItemId(null)}
            aria-hidden
          />
          <div className="relative h-full w-[336px] max-w-[90%] border-l border-line bg-surface">
            <ItemDetailPanel
              item={selectedItem}
              isCube={
                data.categories.find((c) => c.id === selectedItem.categoryId)?.kind === "cube"
              }
              typeName={data.types.find((tp) => tp.id === selectedItem.typeId)?.name}
              categoryName={data.categories.find((c) => c.id === selectedItem.categoryId)?.name}
              locale={i18n.language}
              onEdit={() => setItemEditor({ open: true, item: selectedItem })}
              onDelete={() => setConfirm({ kind: "item", item: selectedItem })}
              onTogglePrimary={() => togglePrimary(selectedItem.id)}
              onToggleFavorite={() => toggleFavorite(selectedItem.id)}
              onClose={() => setSelectedItemId(null)}
            />
          </div>
        </div>
      ) : null}

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <ItemEditorDialog
        open={itemEditor.open}
        onOpenChange={(open) => setItemEditor((current) => ({ ...current, open }))}
        item={itemEditor.item}
        categories={data.categories}
        types={data.types}
        defaultCategoryId={selection.categoryId}
        defaultTypeId={selection.typeId}
        onSave={handleSaveItem}
      />

      <CategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog((current) => ({ ...current, open }))}
        category={categoryDialog.category}
        onSave={handleSaveCategory}
      />

      <TypeDialog
        open={typeDialog.open}
        onOpenChange={(open) => setTypeDialog((current) => ({ ...current, open }))}
        categoryKind={
          data.categories.find((c) => c.id === typeDialog.categoryId)?.kind ?? "gear"
        }
        type={typeDialog.type}
        onSave={handleSaveType}
      />

      <ExclusionsDialog
        open={exclusionsOpen}
        onOpenChange={setExclusionsOpen}
        excluded={data.excludedCategories}
        onToggle={handleToggleExclusion}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function EmptyState({
  hasItems,
  canAdd,
  onAdd,
  onClear,
  isCubeSelection,
}: {
  hasItems: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClear: () => void;
  isCubeSelection: boolean;
}) {
  const { t } = useTranslation("collection");
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center">
      <Package className="size-5 text-ink-3" />
      <p className="text-sm font-medium text-ink-2">
        {hasItems ? t("emptyFiltered") : t("empty")}
      </p>
      <p className="max-w-xs text-[0.75rem] text-ink-3">
        {hasItems ? t("emptyFilteredHint") : isCubeSelection ? t("emptyCubeHint") : t("emptyHint")}
      </p>
      <div className="mt-2 flex gap-2">
        {hasItems ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            {t("filters.clear")}
          </Button>
        ) : null}
        {canAdd ? (
          <Button size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="size-3.5" />
            {t("addItem")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
