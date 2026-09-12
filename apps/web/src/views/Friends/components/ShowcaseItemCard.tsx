"use client";

/**
 * ShowcaseItemCard — one item of a friend's Locker, in read-only mode.
 *
 * It reuses the app's own `ItemMedia`, so a 3D cube looks identical to the one
 * in your Locker (same engine, same skins, same isometric camera) and the grid
 * costs one offscreen render per distinct palette instead of a WebGL context
 * per card.
 *
 * What it CANNOT show is the private half of an item, because it never
 * arrives: `serial`, `smart_id`, prices, `notes` and `links` are excluded by
 * the SQL's whitelist, not by a filter here. A missing price on a friend's
 * showcase is not a UI choice — there is no value to render.
 */

import { Heart, Package, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ItemMedia } from "@/views/Collection/components/ItemMedia";
import { cubeOrderFor } from "@/views/Collection/collectionModel";
import { cn } from "@/lib/utils";
import type { PuzzleCategory } from "@/types";
import type { ShowcaseCategory, ShowcaseItem, ShowcaseType } from "@/services/friends";

export interface ShowcaseItemCardProps {
  item: ShowcaseItem;
  category: ShowcaseCategory | undefined;
  type: ShowcaseType | undefined;
  /** Signed URL of the item's first photo, when one could be signed. */
  photoUrl?: string | null;
  onOpen: (item: ShowcaseItem) => void;
}

/**
 * Mapped, not interpolated: `showcase.status.${item.status}` would type-check
 * as a plain string and break the project's typed i18n (and a status the app
 * does not know yet must fall back to no badge, not to a missing key).
 * `owned` is the norm and carries no badge at all.
 */
const STATUS_KEY = {
  wishlist: "showcase.status.wishlist",
  sold: "showcase.status.sold",
  lent: "showcase.status.lent",
} as const;

export function ShowcaseItemCard({
  item,
  category,
  type,
  photoUrl,
  onOpen,
}: ShowcaseItemCardProps) {
  const { t } = useTranslation("friends");
  const isCube = category?.kind === "cube";
  const label = [item.brand, item.model].filter(Boolean).join(" ") || item.name;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={t("showcase.openItem", { name: label })}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-surface text-left",
        "transition-all duration-150 hover:border-ink-2/40 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-2/40">
        <ItemMedia
          photo={photoUrl ?? null}
          hasPhoto={!photoUrl && item.photos.length > 0}
          palette={item.palette}
          alt={label}
          isCube={isCube}
          order={isCube ? cubeOrderFor(type?.puzzleCategory as PuzzleCategory | null) : undefined}
          categoryIconId={category?.icon ?? undefined}
        />
        {item.isFavorite && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full border border-line bg-surface/90 text-dnf">
            <Heart className="size-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
        {STATUS_KEY[item.status as keyof typeof STATUS_KEY] && (
          <span className="absolute left-2 top-2 rounded-md border border-line bg-surface/90 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-2">
            {t(STATUS_KEY[item.status as keyof typeof STATUS_KEY])}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="truncate text-[0.82rem] font-semibold text-ink" title={label}>
          {label}
        </p>
        <p className="truncate text-[0.68rem] text-ink-3">
          {[item.finish, category?.name].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1">
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 text-[0.65rem] text-ink-2">
              <Star className="size-3 text-caution" aria-hidden="true" />
              {item.rating}
            </span>
          )}
          {item.quantity > 1 && (
            <span className="inline-flex items-center gap-1 text-[0.65rem] text-ink-3">
              <Package className="size-3" aria-hidden="true" />
              {t("showcase.quantity", { count: item.quantity })}
            </span>
          )}
          {item.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="truncate rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[0.6rem] text-ink-2"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
