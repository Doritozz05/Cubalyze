"use client";

/**
 * CollectionView.tsx — the Locker.
 *
 * Two levels, both horizontal and roomy: a **category tab bar** on top, a
 * **type chip row** for the selected category below it, and the item grid under
 * that. The old nested sidebar tree and its per-node ⋯ menus are gone — adding
 * and editing categories/types lives in dedicated manager dialogs, which is
 * what fixes the "cramped" feel of creating types.
 *
 * This file owns the **state**: the selection, the filters, the taxonomy CRUD
 * and every dialog. The chrome is chosen by regime, and both shells compose the
 * very same dialogs:
 *
 *   • touch (<768px) → `CollectionTouchLayout`: one path bar, a status row and
 *     a floating add button, with the product page as a full-screen overlay.
 *   • pointer (≥768px) → the two-row taxonomy and the side spec sheet, exactly
 *     as before.
 *
 * Deliberate choices:
 *   • No carousel, no camera choreography. Selection is contrast; the wall
 *     scrolls. Cubes get a real render from the app's 3D engine (see
 *     `cubeSnapshotService`), everything else gets a photo or a skeleton.
 *   • Background-aware: the view paints no canvas fill, so the theme's custom
 *     background image shows through, like every other view. Panels use
 *     `bg-surface`, which liquid glass already owns.
 *   • Cube categories expose the "main" chip; gear categories never do. A type
 *     may hold several mains, so the toolbar summarises instead of picking one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Download,
  Heart,
  MoreVertical,
  Package,
  Plus,
  RotateCcw,
  Search,
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
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { useCollectionStore } from "./collectionStore";
import { lockerCubeSnapshotService } from "./cubeSnapshotService";
import { deletePhoto, estimateCollectionStorage } from "./collectionPhotos";
import { buildLockerFile, readLockerFile } from "./collectionTransfer";
import { useIsTouch } from "@/hooks/use-mobile";
import {
  ITEM_SORTS,
  ITEM_STATUS_FILTERS,
  SORT_I18N_KEY,
  STATUS_FILTER_I18N_KEY,
  categoryOf,
  countActiveFilters,
  countByStatus,
  cubeOrderFor,
  formatBytes,
  mainsOfCategory,
  queryItems,
  sortItems,
  tagFacets,
  typeOf,
  type CollectionCategory,
  type CollectionSelection,
  type CollectionType,
  type GearItem,
  type ItemSort,
  type ItemStatus,
} from "./collectionModel";
import { CategoryTabs } from "./components/CategoryTabs";
import { TypeChips } from "./components/TypeChips";
import { CategoryDialog, type CategoryDraft } from "./components/CategoryDialog";
import { CategoriesManagerDialog } from "./components/CategoriesManagerDialog";
import { TypesManagerDialog } from "./components/TypesManagerDialog";
import { ItemEditorDialog } from "./components/ItemEditorDialog";
import { ItemGrid } from "./components/ItemGrid";
import { ItemDetailPanel } from "./components/ItemDetailPanel";
import { CollectionTouchLayout } from "./components/CollectionTouchLayout";

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
  const hydrate = useCollectionStore((s) => s.hydrate);
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

  // The collection lives in the local database: read it once on mount. Until it
  // answers, the wall shows a skeleton instead of an empty locker.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Deferred to post-mount (same pattern as MainLayout / AlgorithmDashboard) so
  // the first paint never flashes the wrong shell.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawIsTouch = useIsTouch();
  const isTouch = mounted && rawIsTouch;
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

  // ── Dialogs ─────────────────────────────────────────────────────────────
  const [itemEditor, setItemEditor] = useState<{ open: boolean; item: GearItem | null }>({
    open: false,
    item: null,
  });
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    category: CollectionCategory | null;
  }>({ open: false, category: null });
  const [categoriesManagerOpen, setCategoriesManagerOpen] = useState(false);
  const [typesManagerOpen, setTypesManagerOpen] = useState(false);
  const [storage, setStorage] = useState<{ photos: number; bytes: number } | null>(null);
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

  const selectedCategory = useMemo(
    () => data.categories.find((category) => category.id === selection.categoryId) ?? null,
    [data.categories, selection.categoryId],
  );

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

  /** Every main of the cube category in view — a type may hold more than one. */
  const mainsInView = useMemo(
    () => (selectedCategory?.kind === "cube" ? mainsOfCategory(data, selectedCategory.id) : []),
    [data, selectedCategory],
  );

  // The offscreen cube renders depend on the user's 3D skin: changing it in
  // Appearance must repaint the whole wall, not just the next card.
  const appearance3d = useStore(preferencesStore, (state) => state.appearance3d);
  useEffect(() => {
    lockerCubeSnapshotService.clear();
  }, [appearance3d]);

  // How much the photo store holds. Refreshed when the visible collection
  // changes (an add, a delete, an import), which is exactly when it moves.
  useEffect(() => {
    let alive = true;
    void estimateCollectionStorage()
      .then((estimate) => {
        if (alive) setStorage(estimate ? estimate.photos : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [data.items.length]);

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

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleSaveItem = useCallback(
    (input: Parameters<typeof addItem>[0]) => {
      const editing = itemEditor.item;
      if (editing) {
        // A photo dropped while editing is unreferenced from now on. It is
        // deleted AFTER the row is saved — the editor never deletes anything
        // itself, so cancelling the dialog can not remove a photo the saved
        // item still points at.
        const kept = new Set((input.photos ?? []).map((photo) => photo.id));
        updateItem(editing.id, input);
        for (const photo of editing.photos) {
          if (!kept.has(photo.id)) void deletePhoto(editing.id, photo.id);
        }
      } else {
        setSelectedItemId(addItem(input));
      }
    },
    [itemEditor.item, addItem, updateItem],
  );

  const handleSaveCategory = useCallback(
    (draft: CategoryDraft) => {
      if (categoryDialog.category) {
        updateCategory(categoryDialog.category.id, draft);
      } else {
        setSelection({ categoryId: addCategory(draft), typeId: null });
      }
    },
    [categoryDialog.category, addCategory, updateCategory],
  );

  const handleAddType = useCallback(
    (name: string, puzzleCategory: Parameters<typeof addType>[0]["puzzleCategory"]) => {
      if (!selection.categoryId) return;
      setSelection({
        categoryId: selection.categoryId,
        typeId: addType({ categoryId: selection.categoryId, name, puzzleCategory }),
      });
    },
    [selection.categoryId, addType],
  );

  const handleUpdateType = useCallback(
    (type: CollectionType, patch: { name?: string; puzzleCategory?: Parameters<typeof addType>[0]["puzzleCategory"] }) => {
      updateType(type.id, {
        categoryId: type.categoryId,
        name: patch.name ?? type.name,
        puzzleCategory: "puzzleCategory" in patch ? patch.puzzleCategory : type.puzzleCategory,
      });
    },
    [updateType],
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

  const handleExport = useCallback(async () => {
    try {
      // Photos travel inside the file, so the export has to read them out of
      // IndexedDB first — and it drops the ones whose bytes are already gone
      // rather than shipping a backup full of broken images.
      const { file, photoCount, missingPhotos } = await buildLockerFile(data);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cubeforge-locker-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      if (photoCount > 0) {
        toast.success(t("io.exportedWithPhotos", { count: photoCount, size: formatBytes(blob.size) }));
      } else {
        toast.success(t("io.exported"));
      }
      if (missingPhotos > 0) {
        toast.warning(t("io.exportMissing", { count: missingPhotos }));
      }
    } catch {
      toast.error(t("io.exportFailed"));
    }
  }, [data, t]);

  const handleImportFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        // Both formats are accepted: the current side-car file and every
        // collection ever exported (photos as data URLs) or stored in
        // localStorage before the Locker had a database.
        const { state, importedPhotos, legacyPhotos, skippedPhotos } = await readLockerFile(
          await file.text(),
        );
        replaceState(state);
        setSelection({ categoryId: null, typeId: null });
        setSelectedItemId(null);
        const restoredPhotos = importedPhotos + legacyPhotos;
        toast.success(
          restoredPhotos > 0
            ? t("io.importedWithPhotos", { count: restoredPhotos })
            : t("io.imported"),
        );
        if (skippedPhotos > 0) {
          toast.warning(t("io.importSkipped", { count: skippedPhotos }));
        }
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
  }, [confirm, t, i18n]);

  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === "category") {
      removeCategory(confirm.category.id);
      setSelection({ categoryId: null, typeId: null });
    } else if (confirm.kind === "type") {
      // Non-destructive: its items move up to the category.
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

  const filterCount = countActiveFilters({ status, tags, favoritesOnly });

  const clearFilters = useCallback(() => {
    setStatus("all");
    setTags([]);
    setFavoritesOnly(false);
  }, []);

  /** Toggle one tag in the filter set (case-insensitive, keeps the first spelling). */
  const toggleTag = useCallback((tag: string) => {
    setTags((current) =>
      current.some((entry) => entry.toLowerCase() === tag.toLowerCase())
        ? current.filter((entry) => entry.toLowerCase() !== tag.toLowerCase())
        : [...current, tag],
    );
  }, []);

  const isCubeSelection = selectedCategory?.kind === "cube";

  // ── Render ──────────────────────────────────────────────────────────────

  /**
   * Every editor, manager and confirmation. Hoisted out of the shell so both
   * layouts (pointer and touch) share the exact same dialog surface — a phone
   * never gets a second, divergent editor.
   */
  const dialogs = (
    <>
      <ItemEditorDialog
        open={itemEditor.open}
        onOpenChange={(open) => setItemEditor((current) => ({ ...current, open }))}
        item={itemEditor.item}
        categories={data.categories}
        types={data.types}
        tagSuggestions={tagOptions.map((facet) => facet.tag)}
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

      <CategoriesManagerDialog
        open={categoriesManagerOpen}
        onOpenChange={setCategoriesManagerOpen}
        state={data}
        onAdd={() => {
          setCategoriesManagerOpen(false);
          setCategoryDialog({ open: true, category: null });
        }}
        onEdit={(category) => {
          setCategoriesManagerOpen(false);
          setCategoryDialog({ open: true, category });
        }}
        onDelete={(category) => {
          setCategoriesManagerOpen(false);
          setConfirm({ kind: "category", category });
        }}
      />

      <TypesManagerDialog
        open={typesManagerOpen}
        onOpenChange={setTypesManagerOpen}
        state={data}
        category={selectedCategory}
        onAdd={handleAddType}
        onUpdate={handleUpdateType}
        onDelete={(type) => setConfirm({ kind: "type", type })}
        onToggleExclusion={handleToggleExclusion}
        onSync={() => {
          if (selection.categoryId) syncCategory(selection.categoryId);
        }}
      />

      {/* The import picker lives with the dialogs, not in a header: on touch the
          touch shell is the only thing rendered, and the sheet has to be able to
          open it too. */}
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
    </>
  );

  // ── Touch shell: phones and small tablets get a different composition of
  //    the same pieces (see CollectionTouchLayout).
  if (isTouch) {
    return (
      <div className="relative flex h-full min-h-0 flex-col">
        <CollectionTouchLayout
          state={data}
          items={filtered}
          hydrated={hydrated}
          locale={i18n.language}
          selection={selection}
          onSelectionChange={setSelection}
          selectedItem={selectedItem}
          onSelectItem={(item) => setSelectedItemId(item.id)}
          onCloseItem={() => setSelectedItemId(null)}
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          tagFacets={tagOptions}
          activeTags={tags}
          onToggleTag={toggleTag}
          favoritesOnly={favoritesOnly}
          onToggleFavorites={() => setFavoritesOnly((value) => !value)}
          onClearFilters={clearFilters}
          onNewCategory={() => setCategoryDialog({ open: true, category: null })}
          onManageCategories={() => setCategoriesManagerOpen(true)}
          onManageTypes={() => setTypesManagerOpen(true)}
          onExport={() => void handleExport()}
          onImport={() => importInputRef.current?.click()}
          onAddItem={() => setItemEditor({ open: true, item: null })}
          onEditItem={(item) => setItemEditor({ open: true, item })}
          onDeleteItem={(item) => setConfirm({ kind: "item", item })}
          onTogglePrimary={(item) => togglePrimary(item.id)}
          onToggleFavorite={(item) => toggleFavorite(item.id)}
        />
        {dialogs}
      </div>
    );
  }

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
              {storage && storage.photos > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[0.68rem] text-ink-3">
                    {t("io.storage", {
                      count: storage.photos,
                      size: formatBytes(storage.bytes),
                    })}
                  </div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Navigation: categories on top, types for the current one below. */}
          <div
            data-glass-panel
            className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface/80 px-3 py-3 backdrop-blur-sm"
          >
            <CategoryTabs
              state={data}
              selection={selection}
              onSelect={setSelection}
              onAdd={() => setCategoryDialog({ open: true, category: null })}
              onManage={() => setCategoriesManagerOpen(true)}
            />
            {selectedCategory ? (
              <div className="border-t border-line pt-2.5">
                <TypeChips
                  state={data}
                  category={selectedCategory}
                  selection={selection}
                  onSelect={setSelection}
                  onManage={() => setTypesManagerOpen(true)}
                />
              </div>
            ) : null}
          </div>

          {/* Toolbar: what is in view, the filters, the sort. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[0.82rem] font-medium text-ink">
                {selection.typeId
                  ? data.types.find((tp) => tp.id === selection.typeId)?.name
                  : (selectedCategory?.name ?? t("nav.everything"))}
              </span>
              <span className="shrink-0 tabular-nums text-[0.7rem] text-ink-3">
                {t("results", { count: filtered.length })}
              </span>
              {isCubeSelection ? (
                mainsInView.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(mainsInView[0].id)}
                    className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-canvas transition-opacity hover:opacity-90"
                  >
                    {t("primary")}
                    <span className="hidden max-w-[9rem] truncate font-medium normal-case tracking-normal opacity-80 sm:inline">
                      {mainsInView[0].name}
                    </span>
                    {mainsInView.length > 1 ? (
                      <span className="tabular-nums opacity-70">+{mainsInView.length - 1}</span>
                    ) : null}
                  </button>
                ) : (
                  <span className="hidden shrink-0 rounded-full border border-dashed border-line-2 px-2.5 py-1 text-[0.68rem] text-ink-3 sm:inline">
                    {t("noPrimary")}
                  </span>
                )
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-line bg-surface/70 p-0.5">
                {ITEM_STATUS_FILTERS.map((entry) => (
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
                    {t(STATUS_FILTER_I18N_KEY[entry])}
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
                  {ITEM_SORTS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {t(SORT_I18N_KEY[entry])}
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
                    onClick={() => toggleTag(tag)}
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
            data-glass-panel
            className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-surface/60 p-3 backdrop-blur-sm"
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
          <aside
            data-glass-panel
            className="flex w-[336px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface/80 backdrop-blur-sm"
          >
            {selectedItem ? (
              <ItemDetailPanel
                item={selectedItem}
                isCube={data.categories.find((c) => c.id === selectedItem.categoryId)?.kind === "cube"}
                cubeOrder={cubeOrderFor(typeOf(data, selectedItem.typeId)?.puzzleCategory)}
                categoryIconId={categoryOf(data, selectedItem.categoryId)?.icon}
                typeName={typeOf(data, selectedItem.typeId)?.name}
                categoryName={categoryOf(data, selectedItem.categoryId)?.name}
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

      {/* Narrow screens: the detail opens as a side overlay. */}
      {!isWide && selectedItem ? (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedItemId(null)}
            aria-hidden
          />
          <div data-glass-panel className="relative h-full w-[336px] max-w-[90%] border-l border-line bg-surface">
            <ItemDetailPanel
              item={selectedItem}
              isCube={data.categories.find((c) => c.id === selectedItem.categoryId)?.kind === "cube"}
              cubeOrder={cubeOrderFor(typeOf(data, selectedItem.typeId)?.puzzleCategory)}
              categoryIconId={categoryOf(data, selectedItem.categoryId)?.icon}
              typeName={typeOf(data, selectedItem.typeId)?.name}
              categoryName={categoryOf(data, selectedItem.categoryId)?.name}
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

      {/* ── Dialogs (hoisted above — shared by both shells) ──────────── */}
      {dialogs}
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
