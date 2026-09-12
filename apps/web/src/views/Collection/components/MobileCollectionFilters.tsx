"use client";

/**
 * MobileCollectionFilters.tsx — everything that narrows the wall, in a sheet.
 *
 * Status is the one filter worth a permanent row on the phone (it is the
 * question people actually ask: "what do I own?"). Sort order, favourites and
 * the tag vocabulary are occasional, and inline they cost three lines of
 * vertical space above the grid — so on touch they live here, behind a button
 * that carries the count of what is currently active.
 *
 * The controls are the same ones the desktop toolbar uses (shared `Switch`,
 * `Select` and token-styled chips), sized for a thumb: every row is at least
 * 44px tall.
 */

import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TouchPanel } from "@/components/TouchPanel";
import { cn } from "@/lib/utils";
import { ITEM_SORTS, SORT_I18N_KEY, type ItemSort } from "../collectionModel";

export interface MobileCollectionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sort: ItemSort;
  onSortChange: (sort: ItemSort) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  tagFacets: readonly { tag: string; count: number }[];
  activeTags: readonly string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  /** How many filters are narrowing the grid — 0 disables the clear button. */
  activeCount: number;
}

export function MobileCollectionFilters({
  open,
  onOpenChange,
  sort,
  onSortChange,
  favoritesOnly,
  onToggleFavorites,
  tagFacets,
  activeTags,
  onToggleTag,
  onClear,
  activeCount,
}: MobileCollectionFiltersProps) {
  const { t } = useTranslation("collection");

  return (
    <TouchPanel open={open} onOpenChange={onOpenChange} title={t("mobile.filters")}>
      <div className="space-y-4">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-[0.8rem] font-medium text-ink">{t("mobile.sortBy")}</span>
          <Select value={sort} onValueChange={(value) => onSortChange(value as ItemSort)}>
            <SelectTrigger size="sm" className="w-[10.5rem]">
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

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[0.8rem] font-medium text-ink">{t("filters.favorites")}</span>
          <Switch checked={favoritesOnly} onCheckedChange={onToggleFavorites} />
        </label>

        {tagFacets.length > 0 ? (
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("editor.tags")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tagFacets.map(({ tag, count }) => {
                const active = activeTags.some((entry) => entry.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggleTag(tag)}
                    className={cn(
                      "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.72rem] transition-colors touch-manipulation",
                      active
                        ? "border-transparent bg-ink text-canvas"
                        : "border-line text-ink-3 active:text-ink",
                    )}
                  >
                    <span className="max-w-[9rem] truncate">{tag}</span>
                    <span className="tabular-nums opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={activeCount === 0}
          onClick={onClear}
          className={cn(
            "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-[0.78rem] font-medium transition-colors touch-manipulation",
            activeCount === 0
              ? "text-ink-3/60"
              : "text-ink-2 active:bg-surface-2",
          )}
        >
          <RotateCcw className="size-3.5" />
          {t("filters.clear")}
        </button>
      </div>
    </TouchPanel>
  );
}
