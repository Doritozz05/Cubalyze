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
 * The camera slot at the bottom of the wall is the "Main" flag; it is a theme
 * chip, not a star icon, so it reads at a glance and still belongs to the
 * product instead of floating over it.
 */

import { useTranslation } from "react-i18next";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemMedia } from "./ItemMedia";
import { STATUS_I18N_KEY, formatPrice, type CollectionCategory, type GearItem } from "../collectionModel";

export interface ItemCardProps {
  item: GearItem;
  category: CollectionCategory | undefined;
  typeName?: string;
  /** 3D order for cube renders (2×2 vs 3×3). */
  cubeOrder?: number;
  selected: boolean;
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
  onSelect,
  onTogglePrimary,
  onToggleFavorite,
  locale,
}: ItemCardProps) {
  const { t } = useTranslation("collection");
  const isCube = category?.kind === "cube";
  const price = formatPrice(item.price, locale);
  const meta = [typeName ?? t("nav.uncategorised"), item.brand].filter(Boolean).join(" · ");
  const visibleTags = item.tags.slice(0, 2);
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
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-colors",
        selected
          ? "border-line-2 bg-surface ring-1 ring-ink/20"
          : "border-line bg-surface/70 hover:border-line-2 hover:bg-surface",
      )}
    >
      {/* Media — flush with the card's top corners, fixed ratio for an even wall. */}
      <div className="relative aspect-[5/4] w-full overflow-hidden border-b border-line bg-surface-2/30">
        <ItemMedia
          photo={item.photos[0]}
          palette={item.palette}
          alt={item.name}
          isCube={isCube}
          order={cubeOrder}
          categoryIconId={category?.icon}
          variant="card"
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {isCube ? (
              <MainChip
                active={item.primary}
                label={item.primary ? t("unsetPrimary") : t("setPrimary")}
                onToggle={onTogglePrimary}
              />
            ) : null}
            {item.status !== "owned" ? (
              <span className="pointer-events-none rounded-full border border-line bg-surface/90 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.08em] text-ink-2 backdrop-blur-sm">
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
              "pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition",
              item.favorite
                ? "border-line-2 bg-surface/95 text-ink"
                : "border-transparent bg-surface/85 text-ink-3 opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <Heart className={cn("size-3.5", item.favorite && "fill-current")} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.82rem] font-medium leading-tight text-ink">{item.name}</h3>
          <p className="mt-0.5 truncate text-[0.68rem] text-ink-3">{meta}</p>
        </div>

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="max-w-[7rem] truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.62rem] text-ink-3"
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 ? <span className="text-[0.62rem] text-ink-3">+{extraTags}</span> : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2">
          <div className="flex min-w-0 items-center gap-2">
            {item.rating ? (
              <span className="flex items-center gap-0.5 text-[0.66rem] tabular-nums text-ink-2">
                <Star className="size-3 fill-current" />
                {item.rating}
              </span>
            ) : null}
            {item.quantity > 1 ? (
              <span className="text-[0.66rem] tabular-nums text-ink-3">×{item.quantity}</span>
            ) : null}
          </div>
          {price ? (
            <span className="shrink-0 text-[0.68rem] font-medium tabular-nums text-ink-2">
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
  label,
  onToggle,
}: {
  active: boolean;
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
        "pointer-events-auto rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] transition",
        active
          ? "border border-transparent bg-ink text-canvas"
          : "border border-dashed border-line-2 bg-surface/85 text-ink-3 backdrop-blur-sm hover:border-ink/40 hover:text-ink",
      )}
    >
      {t("primary")}
    </button>
  );
}
