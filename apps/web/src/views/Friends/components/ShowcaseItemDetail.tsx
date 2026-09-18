"use client";

/**
 * ShowcaseItemDetail — a friend's item, in full.
 *
 * The dialog exists to show what a card cannot: the rest of the photos, at
 * full size, plus the attributes the wire does carry. It signs those photos on
 * demand — one call for the item's remaining refs, because a detail view is
 * opened once and the signed URLs expire in a minute anyway; pre-signing a
 * whole page of full-size photos would be quota for pictures nobody looks at.
 *
 * There is no edit affordance and none is hidden: nothing here can be written
 * (the social surface has no write path into someone else's Locker), and the
 * private fields (`serial`, `smart_id`, price, notes, links) are absent from
 * the payload itself.
 */

import { useEffect, useMemo, useState } from "react";
import { Flag, Heart, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildReportMailto } from "@/utils/reportContent";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ItemMedia } from "@/views/Collection/components/ItemMedia";
import { cubeOrderFor } from "@/views/Collection/collectionModel";
import { getSupabaseClient } from "@/services/sync";
import { fetchPhotoUrls, photoKey, type ShowcaseCategory, type ShowcaseItem, type ShowcaseType } from "@/services/friends";
import { cn } from "@/lib/utils";
import type { PuzzleCategory } from "@/types";

export interface ShowcaseItemDetailProps {
  owner: string;
  /** Raw handle (without @) for pre-filling content reports. */
  ownerHandle?: string | null;
  item: ShowcaseItem | null;
  category: ShowcaseCategory | undefined;
  type: ShowcaseType | undefined;
  /** Thumbs already signed by the grid, reused as placeholders. */
  thumbUrls: Record<string, string>;
  onClose: () => void;
}

const STATUS_KEY = {
  wishlist: "showcase.status.wishlist",
  sold: "showcase.status.sold",
  lent: "showcase.status.lent",
} as const;

export function ShowcaseItemDetail({
  owner,
  ownerHandle,
  item,
  category,
  type,
  thumbUrls,
  onClose,
}: ShowcaseItemDetailProps) {
  const { t, i18n } = useTranslation("friends");
  const { t: tLegal } = useTranslation("legal");
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const photoIds = useMemo(() => (item?.photos ?? []).map((photo) => photo.id), [item]);

  useEffect(() => {
    setActiveIndex(0);
    setFullUrls({});
  }, [item?.id]);

  useEffect(() => {
    if (!item || photoIds.length === 0) return;
    let alive = true;
    void fetchPhotoUrls(
      getSupabaseClient(),
      owner,
      photoIds.map((photoId) => ({ itemId: item.id, photoId, size: "full" as const })),
    ).then((batch) => {
      if (alive) setFullUrls(batch.urls);
    });
    return () => {
      alive = false;
    };
  }, [owner, item, photoIds]);

  if (!item) return null;

  const isCube = category?.kind === "cube";
  const label = [item.brand, item.model].filter(Boolean).join(" ") || item.name;
  const activePhotoId = photoIds[activeIndex];
  const activeUrl = activePhotoId
    ? (fullUrls[photoKey(item.id, activePhotoId)] ?? thumbUrls[photoKey(item.id, activePhotoId)] ?? null)
    : null;
  const statusKey = STATUS_KEY[item.status as keyof typeof STATUS_KEY];
  const acquired =
    item.acquiredAt && item.acquiredAt.length > 0
      ? new Date(item.acquiredAt).toLocaleDateString(i18n.language, {
          year: "numeric",
          month: "long",
        })
      : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="relative aspect-square w-full bg-surface-2/40">
            <ItemMedia
              photo={activeUrl}
              hasPhoto={!activeUrl && photoIds.length > 0}
              palette={item.palette}
              alt={label}
              isCube={isCube}
              order={isCube ? cubeOrderFor(type?.puzzleCategory as PuzzleCategory | null) : undefined}
              categoryIconId={category?.icon ?? undefined}
              variant="hero"
            />
            {photoIds.length > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2 py-1">
                {photoIds.map((photoId, index) => (
                  <button
                    key={photoId}
                    type="button"
                    aria-label={t("showcase.photo", { index: index + 1 })}
                    aria-current={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "size-2 cursor-pointer rounded-full transition-colors",
                      index === activeIndex ? "bg-ink" : "bg-ink-3/50 hover:bg-ink-3",
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 p-5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-ink" title={label}>
                {label}
              </h2>
              <p className="mt-0.5 truncate text-[0.75rem] text-ink-3">
                {[item.name, item.finish].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {category && <Badge variant="secondary">{category.name}</Badge>}
              {type && <Badge variant="secondary">{type.name}</Badge>}
              {statusKey && <Badge variant="outline">{t(statusKey)}</Badge>}
              {item.condition && <Badge variant="outline">{item.condition}</Badge>}
              {item.rating != null && (
                <span className="inline-flex items-center gap-1 text-[0.72rem] text-ink-2">
                  <Star className="size-3.5 text-caution" aria-hidden="true" />
                  {item.rating}
                </span>
              )}
              {item.isFavorite && <Heart className="size-3.5 fill-current text-dnf" aria-hidden="true" />}
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.72rem]">
              {acquired && (
                <>
                  <dt className="text-ink-3">{t("showcase.acquired")}</dt>
                  <dd className="text-right text-ink-2">{acquired}</dd>
                </>
              )}
              <dt className="text-ink-3">{t("showcase.quantityLabel")}</dt>
              <dd className="nums text-right text-ink-2">{item.quantity}</dd>
              {item.tags.length > 0 && (
                <>
                  <dt className="text-ink-3">{t("showcase.tags")}</dt>
                  <dd className="text-right text-ink-2">{item.tags.join(", ")}</dd>
                </>
              )}
            </dl>

            <p className="mt-auto text-[0.65rem] leading-4 text-ink-3">
              {t("showcase.readOnlyNote")}
            </p>
            {activePhotoId && (
              <a
                href={buildReportMailto({
                  to: tLegal("contactEmail"),
                  subject: t("report.subjectPhoto", {
                    handle: ownerHandle ? `@${ownerHandle}` : owner.slice(0, 8),
                  }),
                  body: t("report.bodyPhoto", {
                    handle: ownerHandle ? `@${ownerHandle}` : owner,
                    userId: owner,
                    itemId: item.id,
                    photoId: activePhotoId,
                    date: new Date().toISOString().slice(0, 10),
                  }),
                })}
                className="inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-[0.68rem] text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
              >
                <Flag className="size-3" aria-hidden="true" />
                {t("card.report")}
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
