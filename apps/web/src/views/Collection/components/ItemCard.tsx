"use client";

/**
 * ItemCard.tsx — one card in the locker grid.
 *
 * Product-card grammar, not a carousel slide: a fixed-ratio media area flush
 * with the card's top corners, then a body with the identity, the tags and a
 * hairline footer that pins the price to the bottom-right. Everything that can
 * be a corner detail *is* one (badges top-left, actions top-right), so a wall
 * of cards scans as one aligned catalogue no matter how tall the content is.
 *
 * Two densities, one component:
 *
 *   • `compact` is the **touch** density — the phone grid runs two columns, so
 *     the media goes square, the body tightens and nothing may hide behind
 *     hover (a finger has none). Every action is on screen at all times.
 *   • the default density is the pointer one, where hover can reveal the
 *     favourite toggle without spending permanent space on it.
 *
 * The "Main" flag is a theme chip in the top-left corner, readable at a glance
 * in both densities.
 */

import { useTranslation } from "react-i18next";
import { Activity, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemMedia } from "./ItemMedia";
import { usePhotoUrl } from "../usePhotoUrl";
import { STATUS_I18N_KEY, formatPrice, type CollectionCategory, type GearItem } from "../collectionModel";

export interface ItemCardProps {
  item: GearItem;
  category: CollectionCategory | undefined;
  typeName?: string;
  /** 3D order for cube renders (2×2 vs 3×3). */
  cubeOrder?: number;
  selected: boolean;
  /**
   * How many solves this cube has, when it can have any (cube categories
   * only). Omitted or 0 renders nothing: a "0 solves" badge on a catalogue of
   * fifty items is noise, not information.
   */
  solveCount?: number;
  /** Touch density: squares the media, tightens the body, pins the actions. */
  compact?: boolean;
  onSelect: () => void;
  onTogglePrimary: () => void;
  onToggleFavorite: () => void;
  locale: string;
}

export function ItemCard({
  item,
  category,
  typeName,
  cubeOrder,
  selected,
  solveCount,
  compact = false,
  onSelect,
  onTogglePrimary,
  onToggleFavorite,
  locale,
}: ItemCardProps) {
  const { t } = useTranslation("collection");
  const isCube = category?.kind === "cube";
  // The cover photo lives in IndexedDB: resolve its reference to a URL, and let
  // the media area keep a shimmer up until the bytes arrive.
  const cover = item.photos[0];
  const coverUrl = usePhotoUrl(item.id, cover?.id, "thumb");
  const price = formatPrice(item.price, locale);
  const meta = [typeName ?? t("nav.uncategorised"), item.brand].filter(Boolean).join(" · ");
  const visibleTags = item.tags.slice(0, compact ? 1 : 2);
  const extraTags = item.tags.length - visibleTags.length;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={item.name}
      data-glass-panel
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-colors touch-manipulation",
        selected
          ? "border-line-2 bg-surface ring-1 ring-ink/20"
          : "border-line bg-surface/70 hover:border-line-2 hover:bg-surface",
      )}
    >
      {/* Media — flush with the card's top corners, fixed ratio for an even wall. */}
      <div
        className={cn(
          "relative w-full overflow-hidden border-b border-line bg-surface-2/30",
          compact ? "aspect-square" : "aspect-[5/4]",
        )}
      >
        <ItemMedia
          photo={coverUrl}
          hasPhoto={Boolean(cover)}
          palette={item.palette}
          alt={item.name}
          isCube={isCube}
          order={cubeOrder}
          categoryIconId={category?.icon}
          variant="card"
        />

        <div className={cn("pointer-events-none absolute flex items-start justify-between gap-1", compact ? "inset-x-1.5 top-1.5" : "inset-x-2 top-2")}>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {isCube ? (
              <MainChip
                active={item.primary}
                compact={compact}
                label={item.primary ? t("unsetPrimary") : t("setPrimary")}
                onToggle={onTogglePrimary}
              />
            ) : null}
            {item.status !== "owned" ? (
              <span
                className={cn(
                  "pointer-events-none rounded-full border border-line bg-surface/90 font-medium uppercase tracking-[0.08em] text-ink-2 backdrop-blur-sm",
                  compact ? "px-1.5 py-0.5 text-[0.55rem]" : "px-2 py-0.5 text-[0.6rem]",
                )}
              >
                {t(STATUS_I18N_KEY[item.status])}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={t("editor.favorite")}
            title={t("editor.favorite")}
            aria-pressed={item.favorite}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "pointer-events-auto flex shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition touch-manipulation",
              compact ? "size-8" : "size-6",
              item.favorite
                ? "border-line-2 bg-surface/95 text-ink"
                : cn(
                    "border-transparent bg-surface/85 text-ink-3 hover:text-ink",
                    // Pointer density only: a finger has no hover to reveal it.
                    !compact && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                  ),
            )}
          >
            <Heart className={cn(compact ? "size-4" : "size-3.5", item.favorite && "fill-current")} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex flex-1 flex-col", compact ? "gap-1.5 p-2.5" : "gap-2 p-3")}>
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate font-medium leading-tight text-ink",
              compact ? "text-[0.78rem]" : "text-[0.82rem]",
            )}
          >
            {item.name}
          </h3>
          <p className={cn("mt-0.5 truncate text-ink-3", compact ? "text-[0.62rem]" : "text-[0.68rem]")}>
            {meta}
          </p>
        </div>

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "max-w-[7rem] truncate rounded-full bg-surface-2 text-ink-3",
                  compact ? "px-1.5 py-0.5 text-[0.58rem]" : "px-1.5 py-0.5 text-[0.62rem]",
                )}
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 ? (
              <span className={cn("text-ink-3", compact ? "text-[0.58rem]" : "text-[0.62rem]")}>
                +{extraTags}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "mt-auto flex items-center justify-between gap-2 border-t border-line",
            compact ? "pt-1.5" : "pt-2",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {solveCount ? (
              <span
                title={t("stats.cardCount", { count: solveCount })}
                className={cn(
                  "flex shrink-0 items-center gap-1 tabular-nums text-ink-3",
                  compact ? "text-[0.6rem]" : "text-[0.66rem]",
                )}
              >
                <Activity className={cn(compact ? "size-2.5" : "size-3")} />
                {solveCount}
              </span>
            ) : null}
            {item.rating ? (
              <span
                className={cn(
                  "flex items-center gap-0.5 tabular-nums text-ink-2",
                  compact ? "text-[0.6rem]" : "text-[0.66rem]",
                )}
              >
                <Star className={cn(compact ? "size-2.5" : "size-3", "fill-current")} />
                {item.rating}
              </span>
            ) : null}
            {item.quantity > 1 ? (
              <span className={cn("tabular-nums text-ink-3", compact ? "text-[0.6rem]" : "text-[0.66rem]")}>
                ×{item.quantity}
              </span>
            ) : null}
          </div>
          {price ? (
            <span
              className={cn(
                "shrink-0 truncate font-medium tabular-nums text-ink-2",
                compact ? "text-[0.62rem]" : "text-[0.68rem]",
              )}
            >
              {price}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * The "Main" flag as a chip — always on screen, in the same corner of every
 * cube card. Active it is a filled theme chip; inactive it is a dashed outline,
 * so the state is readable at a glance without having to hunt for it.
 */
function MainChip({
  active,
  compact,
  label,
  onToggle,
}: {
  active: boolean;
  compact?: boolean;
  label: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation("collection");
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "pointer-events-auto rounded-full font-semibold uppercase tracking-[0.08em] transition touch-manipulation",
        compact ? "px-1.5 py-1 text-[0.55rem]" : "px-2 py-0.5 text-[0.6rem]",
        active
          ? "border border-transparent bg-ink text-canvas"
          : "border border-dashed border-line-2 bg-surface/85 text-ink-3 backdrop-blur-sm hover:border-ink/40 hover:text-ink",
      )}
    >
      {t("primary")}
    </button>
  );
}
