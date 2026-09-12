"use client";

/**
 * FriendDetailView — one friend: who they are, what they share, and their
 * Locker.
 *
 * The scopes are rendered independently on purpose. Sharing is per-scope
 * (`share_profile` / `share_stats` / `share_locker`), so a friend who hides
 * their progress but opens their collection must still get a working
 * showcase — and one who hides everything gets an explanation, not a blank
 * page. Each panel receives its own reason and says what it is.
 *
 * Read-only by construction: nothing on this screen writes, and there is no
 * write path into somebody else's data on the server either.
 */

import { useState } from "react";
import { ArrowLeft, Ban, Package, Star, UserMinus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FriendAvatar } from "./components/FriendAvatar";
import { FriendStatsPanel } from "./components/FriendStatsPanel";
import { ShowcaseGrid } from "./components/ShowcaseGrid";
import { displayNameOf } from "./friendsCopy";
import { useFriendDetail } from "@/hooks/useFriends";
import { CountryFlag } from "@/components/Identity/CountryFlag";
import { cn } from "@/lib/utils";

export interface FriendDetailViewProps {
  userId: string;
  /** Name/handle to show while the profile read is in flight. */
  fallbackName?: string;
  onBack: () => void;
  onRemove: (userId: string) => void;
  onBlock: (userId: string) => void;
  busy?: boolean;
}

export function FriendDetailView({
  userId,
  fallbackName,
  onBack,
  onRemove,
  onBlock,
  busy = false,
}: FriendDetailViewProps) {
  const { t, i18n } = useTranslation("friends");
  const { profile, stats, showcase, errors, loading, loadingMore, hasMore, refresh, loadMore } =
    useFriendDetail(userId);
  const [tab, setTab] = useState("stats");

  const person = profile?.profile ?? null;
  const name = person ? displayNameOf(person) : (fallbackName ?? "");
  const visibility = profile?.visibility;

  const memberSince =
    person && person.createdAt > 0
      ? new Date(person.createdAt).toLocaleDateString(i18n.language, {
          year: "numeric",
          month: "long",
        })
      : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[0.75rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("detail.back")}
      </button>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          {person ? (
            <FriendAvatar profile={person} size={64} />
          ) : (
            <div className="size-16 shrink-0 rounded-full border border-line bg-surface-2/50" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-ink">
              {name || t("card.unnamed")}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[0.75rem] text-ink-3">
              {person?.handle ? `@${person.handle}` : t("card.noHandle")}
              {person?.country ? <CountryFlag country={person.country} /> : null}
            </p>
            {person?.bio && (
              <p className="mt-2 max-w-prose whitespace-pre-wrap text-[0.78rem] leading-5 text-ink-2">
                {person.bio}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-ink-3">
              {memberSince && <span>{t("detail.memberSince", { date: memberSince })}</span>}
              {person && person.mainPuzzle && (
                <span>{t("detail.mainPuzzle", { puzzle: person.mainPuzzle })}</span>
              )}
              {person && person.declaredMethods.length > 0 && (
                <span>{t("detail.methods", { list: person.declaredMethods.join(", ") })}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(userId)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-[0.72rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <UserMinus className="size-3.5" aria-hidden="true" />
              {t("card.remove")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onBlock(userId)}
              aria-label={t("card.block")}
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line text-dnf transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              <Ban className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ScopeChip
            icon={<Star className="size-3" aria-hidden="true" />}
            label={t("scopes.stats")}
            shared={visibility?.stats ?? false}
          />
          <ScopeChip
            icon={<Package className="size-3" aria-hidden="true" />}
            label={t("scopes.locker")}
            shared={visibility?.locker ?? false}
          />
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          aria-label={t("detail.tabsAria")}
          className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-1 py-1.5"
        >
          <TabsTrigger
            value="stats"
            className="h-8 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:shadow-sm"
          >
            {t("detail.statsTab")}
          </TabsTrigger>
          <TabsTrigger
            value="showcase"
            className="h-8 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:shadow-sm"
          >
            {t("detail.showcaseTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <FriendStatsPanel stats={stats} error={errors.stats} loading={loading} />
        </TabsContent>

        <TabsContent value="showcase" className="mt-4">
          <ShowcaseGrid
            owner={userId}
            page={showcase}
            error={errors.showcase}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={() => void loadMore()}
            onRefresh={() => void refresh()}
          />
        </TabsContent>
      </Tabs>

      {loading && !stats && !showcase && (
        <div className="flex justify-center py-6">
          <Spinner size="sm" label={t("detail.loading")} />
        </div>
      )}
    </div>
  );
}

function ScopeChip({
  icon,
  label,
  shared,
}: {
  icon: React.ReactNode;
  label: string;
  shared: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.65rem]",
        shared
          ? "border-line bg-surface-2/50 text-ink-2"
          : "border-dashed border-line text-ink-3",
      )}
    >
      {icon}
      {label}
      <span className="text-ink-3">{shared ? "✓" : "—"}</span>
    </span>
  );
}
