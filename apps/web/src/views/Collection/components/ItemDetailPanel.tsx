"use client";

/**
 * ItemDetailPanel.tsx — the product page for the selected item.
 *
 * IKEA grammar on purpose: identity and badges first, then the picture, then a
 * plain spec table with right-aligned values, then photos, notes and links. It
 * stays legible with ten items or a thousand and never competes with the media
 * for attention.
 *
 * Two variants, one component:
 *
 *   • `panel` — the desktop side column (and the narrow-window overlay): a
 *     close X in the header, the footer inside the panel.
 *   • `overlay` — the touch full-screen sheet: a back bar above the title
 *     (safe-area aware) instead of the X, and a sticky footer padded for the
 *     home indicator. Same content, so a phone shows the same product page.
 *
 * The "Main" flag shows in the header as a display-only badge (mains only).
 * Toggling lives in the editor switch; the grid badge mirrors it.
 */

import { useTranslation } from "react-i18next";
import {
  Activity,
  BluetoothConnected,
  Camera,
  ChevronLeft,
  ExternalLink,
  Heart,
  Link2,
  Pencil,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useStore } from "zustand";
import { toast } from "sonner";
import { formatSmartId } from "@cubeforge/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";
import { hardwareLinkStore } from "@/stores/hardwareLinkStore";
import { ItemMedia } from "./ItemMedia";
import { PhotoImage } from "./PhotoImage";
import { usePhotoUrl } from "../usePhotoUrl";
import {
  CONDITION_I18N_KEY,
  STATUS_I18N_KEY,
  formatAcquired,
  formatPrice,
  type GearItem,
} from "../collectionModel";
import { formatLastUsed, isCubeStatsEmpty } from "../cubeStats";
import { useCubeStats } from "../useCubeStats";
import { formatTime } from "@/utils/formatTime";

interface SpecRow {
  key: string;
  label: string;
  value: string;
}

/** One row of the plain spec grammar this panel already uses. */
function SpecLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[0.74rem] text-ink-3">{label}</dt>
      <dd className="truncate text-right text-[0.78rem] font-medium text-ink">{value}</dd>
    </div>
  );
}

export interface ItemDetailPanelProps {
  item: GearItem;
  isCube: boolean;
  /** Injectable "now" for the "last used" line (tests / SSR stability). */
  now?: number;
  cubeOrder?: number;
  categoryIconId?: string;
  typeName?: string;
  categoryName?: string;
  locale: string;
  /** `panel` (default) or the touch full-screen `overlay`. */
  variant?: "panel" | "overlay";
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onClose?: () => void;
}

export function ItemDetailPanel({
  item,
  isCube,
  now,
  cubeOrder,
  categoryIconId,
  typeName,
  categoryName,
  locale,
  variant = "panel",
  onEdit,
  onDelete,
  onToggleFavorite,
  onClose,
}: ItemDetailPanelProps) {
  const { t } = useTranslation("collection");
  const overlay = variant === "overlay";
  // Product page shows the full rendition; the gallery below uses thumbnails.
  const cover = item.photos[0];
  const coverUrl = usePhotoUrl(item.id, cover?.id, "full");

  // Only a cube category can be the target of a solve attribution (see
  // views/Collection/activeCube.ts), so the numbers are asked for — and shown —
  // for cubes only. The hook is still called unconditionally: hooks cannot be
  // conditional, and an item id of null simply resolves to "no numbers".
  const { stats, loading: statsLoading } = useCubeStats(isCube ? item.id : null);
  const lastUsed = formatLastUsed(stats?.lastUsedAt ?? null, now ?? Date.now(), locale);
  const statRows: SpecRow[] = [];
  if (stats && !isCubeStatsEmpty(stats)) {
    if (stats.best) {
      statRows.push({ key: "best", label: t("stats.best"), value: formatTime(stats.best.timeMs) });
    }
    if (stats.bestAo5 != null) {
      statRows.push({ key: "ao5", label: t("stats.ao5"), value: formatTime(stats.bestAo5) });
    }
    if (stats.bestAo12 != null) {
      statRows.push({ key: "ao12", label: t("stats.ao12"), value: formatTime(stats.bestAo12) });
    }
    if (stats.mean != null) {
      statRows.push({ key: "mean", label: t("stats.mean"), value: formatTime(stats.mean) });
    }
    if (lastUsed) {
      statRows.push({ key: "lastUsed", label: t("stats.lastUsed"), value: lastUsed });
    }
  }

  // The connected cube, and whether it is THIS item: what turns the Locker from
  // a catalogue into the place the hardware points at. Only read (the headless
  // service already resolved it); the buttons below are the only writes.
  const link = useStore(hardwareLinkStore);
  const isLinkedHere = link.status === "linked" && link.itemId === item.id;
  const hardwareAddress = link.mac !== null;

  const useConnectedCube = () => {
    const result = link.linkTo(item.id);
    if (!result.ok) {
      toast.error(
        result.reason === "taken"
          ? t("hardware.taken")
          : i18n.t("toast:cubeConnectFailed"),
      );
    }
  };

  const rows: SpecRow[] = [];
  if (categoryName) rows.push({ key: "category", label: t("spec.category"), value: categoryName });
  if (typeName) rows.push({ key: "type", label: t("spec.type"), value: typeName });
  if (item.brand) rows.push({ key: "brand", label: t("spec.brand"), value: item.brand });
  if (item.model) rows.push({ key: "model", label: t("spec.model"), value: item.model });
  if (item.finish) rows.push({ key: "finish", label: t("spec.finish"), value: item.finish });
  if (item.condition) {
    rows.push({
      key: "condition",
      label: t("spec.condition"),
      value: t(CONDITION_I18N_KEY[item.condition]),
    });
  }
  if (item.quantity > 1) rows.push({ key: "quantity", label: t("spec.quantity"), value: `×${item.quantity}` });
  if (item.rating) rows.push({ key: "rating", label: t("spec.rating"), value: `${item.rating}/5` });
  if (item.serial) rows.push({ key: "serial", label: t("spec.serial"), value: item.serial });
  const smartAddress = formatSmartId(item.smartId);
  if (smartAddress) rows.push({ key: "smartId", label: t("spec.smartId"), value: smartAddress });
  const acquired = formatAcquired(item.acquiredAt, locale);
  if (acquired) rows.push({ key: "acquired", label: t("spec.acquired"), value: acquired });
  const price = formatPrice(item.price, locale);
  if (price) rows.push({ key: "price", label: t("spec.price"), value: price });

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Touch: a proper back bar, above the product title. */}
      {overlay ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 pt-safe pb-1">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1 flex h-11 items-center gap-1 rounded-lg pl-1 pr-2.5 text-[0.8rem] font-medium text-ink-2 transition-colors active:bg-surface-2 touch-manipulation"
          >
            <ChevronLeft className="size-5" />
            {t("mobile.back")}
          </button>
          <span className="min-w-0 flex-1 truncate text-right text-[0.68rem] text-ink-3">
            {[categoryName, typeName].filter(Boolean).join(" · ")}
          </span>
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-ink">{item.name}</h2>
          {item.brand || item.model ? (
            <p className="mt-0.5 truncate text-[0.72rem] text-ink-3">
              {[item.brand, item.model].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isCube && item.primary ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="rounded-full border border-canvas/40 bg-ink px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-canvas">
                    {t("primary")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("editor.mainHint")}</TooltipContent>
              </Tooltip>
            ) : null}
            {item.favorite ? (
              <Badge variant="outline" className="gap-1 rounded-full text-[0.6rem] font-normal">
                <Heart className="size-2.5 fill-current" />
                {t("editor.favorite")}
              </Badge>
            ) : null}
            {item.status !== "owned" ? (
              <Badge variant="secondary" className="rounded-full text-[0.6rem] font-normal">
                {t(STATUS_I18N_KEY[item.status])}
              </Badge>
            ) : null}
          </div>
        </div>
        {onClose && !overlay ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={i18n.t("common:close")}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2/30">
          <ItemMedia
            photo={coverUrl}
            hasPhoto={Boolean(cover)}
            palette={item.palette}
            alt={item.name}
            isCube={isCube}
            order={cubeOrder}
            categoryIconId={categoryIconId}
            variant="hero"
          />
        </div>

        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="rounded-full text-[0.65rem] font-normal text-ink-3">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {item.notes ? (
          <p className="text-[0.78rem] leading-relaxed text-ink-2">{item.notes}</p>
        ) : null}

        <dl className="divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-[0.74rem] text-ink-3">{row.label}</dt>
              <dd className="truncate text-right text-[0.78rem] font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>

        {isCube && (smartAddress || hardwareAddress) ? (
          <section>
            <h3 className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              <BluetoothConnected className="size-3" />
              {t("hardware.title")}
            </h3>

            {isLinkedHere ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="gap-1 rounded-full text-[0.6rem] font-normal">
                  <BluetoothConnected className="size-2.5" />
                  {t("hardware.connectedNow")}
                </Badge>
              </div>
            ) : null}

            {isLinkedHere ? (
              <dl className="mt-2 divide-y divide-line border-y border-line">
                {link.identity?.hardwareVersion ? (
                  <SpecLine label={t("hardware.firmware")} value={link.identity.hardwareVersion} />
                ) : null}
                {link.identity?.softwareVersion ? (
                  <SpecLine label={t("hardware.software")} value={link.identity.softwareVersion} />
                ) : null}
                {link.identity?.productDate ? (
                  <SpecLine label={t("hardware.productionDate")} value={link.identity.productDate} />
                ) : null}
              </dl>
            ) : null}

            {!isLinkedHere && hardwareAddress ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-2 text-xs"
                onClick={useConnectedCube}
              >
                <Link2 className="size-3.5" />
                {t("hardware.useConnected")}
              </Button>
            ) : null}

            {isLinkedHere ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-2 text-xs text-ink-3"
                onClick={() => link.unlink()}
              >
                <Unlink className="size-3.5" />
                {t("hardware.unlink")}
              </Button>
            ) : null}
          </section>
        ) : null}

        {isCube ? (
          <section>
            <h3 className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              <Activity className="size-3" />
              {t("stats.title")}
              {stats && stats.count > 0 ? (
                <span className="tabular-nums opacity-70">
                  {t("stats.count", { count: stats.count })}
                </span>
              ) : null}
            </h3>
            {statRows.length > 0 ? (
              <dl className="mt-2 divide-y divide-line border-y border-line">
                {statRows.map((row) => (
                  <div key={row.key} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-[0.74rem] text-ink-3">{row.label}</dt>
                    <dd className="truncate text-right text-[0.78rem] font-medium tabular-nums text-ink">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-3">
                {statsLoading && isCube ? t("stats.loading") : t("stats.empty")}
                {!statsLoading ? (
                  <span className="mt-0.5 block text-ink-3/80">{t("stats.emptyHint")}</span>
                ) : null}
              </p>
            )}
          </section>
        ) : null}

        <section>
          <h3 className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
            <Camera className="size-3" />
            {t("photos")}
            {item.photos.length > 1 ? (
              <span className="tabular-nums opacity-70">{item.photos.length}</span>
            ) : null}
          </h3>
          {item.photos.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {item.photos.map((photo) => (
                <PhotoImage
                  key={photo.id}
                  itemId={item.id}
                  photo={photo}
                  size="thumb"
                  className="aspect-square w-full rounded-lg border border-line object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[0.7rem] text-ink-3">{t("noPhotos")}</p>
          )}
        </section>

        {item.links.length > 0 ? (
          <section>
            <h3 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("links")}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.links.map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[0.72rem] text-ink-2 transition-colors active:bg-surface-2"
                >
                  {link.label || link.url}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-line bg-surface px-4 pt-3",
          overlay ? "pb-3 pb-safe" : "pb-3",
        )}
      >
        <Button
          variant="outline"
          size="icon"
          aria-pressed={item.favorite}
          aria-label={t("editor.favorite")}
          onClick={onToggleFavorite}
        >
          <Heart className={cn("size-3.5", item.favorite && "fill-current")} />
        </Button>
        <Button variant="outline" size="sm" className="flex-1 justify-center gap-2" onClick={onEdit}>
          <Pencil className="size-3.5" />
          {t("edit")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={i18n.t("common:delete")}
          title={i18n.t("common:delete")}
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </footer>
    </div>
  );
}
