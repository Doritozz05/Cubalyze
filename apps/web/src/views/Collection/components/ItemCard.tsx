"use client";

/**
 * ItemCard.tsx — one card in the locker grid.
 *
 * Deliberately flat: a hairline, the procedural glyph, name and a small meta
 * row. Selection is contrast (border + ring), never depth or scale, so a wall
 * of cards scans as a catalogue rather than a carousel.
 */

import { useTranslation } from "react-i18next";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GearGlyph } from "../GearGlyph";
import {
  STATUS_I18N_KEY,
  formatPrice,
  type GearItem,
} from "../collectionModel";

export interface ItemCardProps {
  item: GearItem;
  isCube: boolean;
  typeName?: string;
  selected: boolean;
  onSelect: () => void;
  onTogglePrimary: () => void;
  onToggleFavorite: () => void;
  locale: string;
}

export function ItemCard({
  item,
  isCube,
  typeName,
  selected,
  onSelect,
  onTogglePrimary,
  onToggleFavorite,
  locale,
}: ItemCardProps) {
  const { t } = useTranslation("collection");
  const price = formatPrice(item.price, locale);
  const isWishlist = item.status === "wishlist";
  const meta = [item.brand, item.finish].filter(Boolean).join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={item.name}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-line-2 bg-surface ring-1 ring-ink/20"
          : "border-line bg-surface/70 hover:border-line-2 hover:bg-surface",
      )}
    >
      {/* Top-right actions — only on hover / focus / when active. */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        {isCube ? (
          <IconToggle
            active={item.primary}
            label={t("primary")}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePrimary();
            }}
            icon={<Star className={cn("size-3.5", item.primary && "fill-current")} />}
          />
        ) : null}
        <IconToggle
          active={item.favorite}
          label={t("editor.favorite")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          icon={<Heart className={cn("size-3.5", item.favorite && "fill-current")} />}
        />
      </div>

      <div className="flex h-[92px] items-center justify-center">
        <GearGlyph item={item} isCube={isCube} size={78} />
      </div>

      <div className="min-w-0">
        <div className="truncate text-[0.8rem] font-medium text-ink">{item.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[0.66rem] text-ink-3">
          <span className="truncate">{typeName ?? t("taxonomy.uncategorised")}</span>
          {meta ? <span className="truncate">· {meta}</span> : null}
        </div>
      </div>

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.62rem] text-ink-3"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 ? (
            <span className="text-[0.62rem] text-ink-3">+{item.tags.length - 2}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {item.status !== "owned" ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide",
              isWishlist ? "bg-surface-2 text-ink-2" : "text-ink-3",
            )}
          >
            {t(STATUS_I18N_KEY[item.status])}
          </span>
        ) : (
          <span className="text-[0.66rem] tabular-nums text-ink-3">
            {item.quantity > 1 ? `×${item.quantity}` : ""}
          </span>
        )}
        {price ? <span className="text-[0.66rem] tabular-nums text-ink-2">{price}</span> : null}
      </div>
    </div>
  );
}

function IconToggle({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-6 items-center justify-center rounded-full border transition-colors",
        active
          ? "border-line-2 bg-surface text-ink"
          : "border-transparent bg-surface/80 text-ink-3 opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100",
      )}
    >
      {icon}
    </button>
  );
}
