"use client";

/**
 * ShowcaseGrid — a friend's Locker, read-only.
 *
 * Three things worth knowing:
 *
 *  1. **Photos are signed in ONE batch per page.** The bytes are never public:
 *     the server signs exactly the refs it was asked about, for a minute. When
 *     signing fails (offline, function not deployed, no longer shared) the grid
 *     simply shows the 3D render — every cube still has a picture because the
 *     palette travels with the item, so the wall is never blank because of a
 *     network problem.
 *
 *  2. **Paging is keyset, not offset.** The cursor is the last `(category, id)`
 *     the server sent; appending pages cannot duplicate or skip an item even if
 *     the friend is editing their Locker while you browse.
 *
 *  3. **Categories are a filter, not a request.** The taxonomy arrives whole
 *     with page one (it is tiny), so switching tabs is instant and costs no
 *     quota.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/Insights/atoms/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/services/sync";
import { fetchPhotoUrls, photoKey, type FriendsFailure, type ShowcaseItem, type ShowcasePage } from "@/services/friends";
import { ShowcaseItemCard } from "./ShowcaseItemCard";
import { ShowcaseItemDetail } from "./ShowcaseItemDetail";
import { FRIEND_FAILURE_KEY } from "../friendsCopy";
import { cn } from "@/lib/utils";

/**
 * How long before a signed batch dies the next one is requested, and the
 * smallest life a batch may have and still be worth re-arming. Signed URLs
 * live 60 s server-side, so the normal path re-signs at ~45 s.
 *
 * They are deliberately the same number: it makes the re-arm condition a
 * single comparison (`delay >= REFRESH_MARGIN_MS`) with no floor to fall back
 * on. A floor is what turns clock skew into a loop — see the effect below.
 */
const REFRESH_MARGIN_MS = 15_000;

export interface ShowcaseGridProps {
  owner: string;
  page: ShowcasePage | null;
  error?: FriendsFailure;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
}

export function ShowcaseGrid({
  owner,
  page,
  error,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRefresh,
}: ShowcaseGridProps) {
  const { t } = useTranslation("friends");
  const [category, setCategory] = useState<string | "all">("all");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);

  // Memoised so the `?? []` fallback is one stable reference: an inline
  // literal would re-create the array on every render and invalidate the
  // memos below (and the photo batch with them) on every keystroke elsewhere.
  const items = useMemo(() => page?.items ?? [], [page]);
  const categories = useMemo(() => page?.categories ?? [], [page]);

  // Sign the FIRST photo of each item in this page — one call, thumbs only.
  // (The detail dialog signs the rest of that item's photos on demand.)
  const firstPhotoRefs = useMemo(
    () =>
      items
        .filter((item) => item.photos.length > 0)
        .map((item) => ({
          itemId: item.id,
          photoId: item.photos[0].id,
          size: "thumb" as const,
        })),
    [items],
  );

  // A different friend means a different set of signatures. Clearing on `owner`
  // (instead of merging forever) means a URL signed for one Locker can never be
  // painted on another's item, even if two collections happen to reuse the same
  // item/photo ids.
  useEffect(() => {
    setPhotoUrls({});
  }, [owner]);

  useEffect(() => {
    if (firstPhotoRefs.length === 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Signing is re-armed BEFORE the TTL runs out. Signed URLs live 60 s and the
    // map is what paints any card that renders after that (a new page, a
    // re-render): without this, a batch signed once would quietly turn into
    // broken images a minute later. A refused or empty batch is NOT retried —
    // retrying a rate limit is how you turn one refusal into a hammer.
    const sign = async () => {
      const batch = await fetchPhotoUrls(getSupabaseClient(), owner, firstPhotoRefs);
      if (!alive) return;
      if (Object.keys(batch.urls).length === 0) return;
      setPhotoUrls((prev) => ({ ...prev, ...batch.urls }));
      if (batch.expiresAt == null) return;
      // Only when the batch has more than the margin of life left AFTER the
      // margin is set aside. A batch that does not means our clock reads ahead
      // of the signer's, and every re-signed batch would be born equally
      // short: a 15 s timer would re-fire forever, which is a hammer on our
      // own edge function over URLs that were about to die anyway. Stopping is
      // the honest move — the URLs already handed out stay valid for the
      // browser (expiry is enforced server-side), and the next page or friend
      // signs from scratch.
      const delay = batch.expiresAt - Date.now() - REFRESH_MARGIN_MS;
      if (delay >= REFRESH_MARGIN_MS) timer = setTimeout(() => void sign(), delay);
    };

    void sign();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [owner, firstPhotoRefs]);

  const visible = useMemo(
    () => (category === "all" ? items : items.filter((item) => item.categoryId === category)),
    [items, category],
  );

  const typesById = useMemo(
    () => new Map((page?.types ?? []).map((type) => [type.id, type])),
    [page?.types],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((entry) => [entry.id, entry])),
    [categories],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <EmptyState
          icon={<Package className="size-5" />}
          title={t(
            error === "not_shared" ? "showcase.notSharedTitle" : "showcase.unavailableTitle",
          )}
          description={t(FRIEND_FAILURE_KEY[error])}
        />
      </div>
    );
  }

  if (!page || items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <EmptyState
          icon={<Package className="size-5" />}
          title={t("showcase.emptyTitle")}
          description={t("showcase.emptyDescription")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={t("showcase.categories")}
          className="flex flex-wrap items-center gap-1.5"
        >
          <CategoryChip
            label={t("showcase.allCategories")}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {categories.map((entry) => (
            <CategoryChip
              key={entry.id}
              label={entry.name}
              active={category === entry.id}
              onClick={() => setCategory(entry.id)}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[0.68rem] text-ink-3">
            {t("showcase.itemCount", { count: visible.length })}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label={t("showcase.refresh")}
            className="grid size-7 cursor-pointer place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.78rem] text-ink-3">
          {t("showcase.emptyCategory")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <ShowcaseItemCard
              key={item.id}
              item={item}
              category={categoriesById.get(item.categoryId)}
              type={item.typeId ? typesById.get(item.typeId) : undefined}
              photoUrl={
                item.photos.length > 0
                  ? (photoUrls[photoKey(item.id, item.photos[0].id)] ?? null)
                  : null
              }
              onOpen={setSelected}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-4 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {t("showcase.loadMore")}
          </button>
        </div>
      )}

      <ShowcaseItemDetail
        owner={owner}
        item={selected}
        category={selected ? categoriesById.get(selected.categoryId) : undefined}
        type={selected?.typeId ? typesById.get(selected.typeId) : undefined}
        thumbUrls={photoUrls}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border px-2.5 py-1 text-[0.72rem] transition-colors",
        active
          ? "border-line bg-surface-2 font-semibold text-ink"
          : "border-transparent text-ink-3 hover:bg-surface-2/60 hover:text-ink-2",
      )}
    >
      {label}
    </button>
  );
}
