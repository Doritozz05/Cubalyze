"use client";

import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@cubeforge/database";
import { IdenticonAvatar } from "./IdenticonAvatar";
import { CountryFlag } from "./CountryFlag";
import { SubBadge, SubBadgeOverflow, rollSubBadgeStyle } from "./SubBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SubBadge as SubBadgeData } from "@/utils/subBadges";
import { SUB_BADGE_WINDOW } from "@/utils/subBadges";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import { formatTime } from "@/utils/formatTime";

export interface ProfileHeroProps {
  profile: Profile | null;
  loading?: boolean;
  /** Opens the Profile editor (Settings → Profile). */
  onEdit?: () => void;
  /**
   * Sub-X milestone badges, earned by a trimmed average per puzzle (best ao100,
   * ao12 while there is no ao100 yet) — never by a lucky single. See
   * utils/subBadges.ts for the rule.
   */
  badges?: SubBadgeData[];
  /**
   * CubeMark seed — the ORIGINAL anonymous id even after an account links
   * the device (parked in app_meta as identicon_seed). Falls back to the
   * profile's userId so the mark never changes on login.
   */
  seed?: string;
  className?: string;
}

function formatMemberSince(createdAt: number, locale: string): string {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
  });
}

/**
 * B1 — Hero / Identity zone (docs/plan_profile).
 * Avatar + display name + handle + identity chips (member since, main puzzle,
 * declared methods) + Sub-X milestone badges + optional bio. All values come
 * from the real profile row; badges come from the PB stats.
 */
export function ProfileHero({
  profile,
  loading,
  onEdit,
  badges = [],
  seed,
  className,
}: ProfileHeroProps) {
  const { t, i18n } = useTranslation("profile");
  const isTouch = useIsTouch();
  const avatarSize = isTouch ? 80 : 100;

  if (loading || !profile) {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-xl border border-line bg-surface p-5 sm:gap-6 sm:p-6",
          className,
        )}
      >
        <Skeleton
          className="shrink-0 rounded-xl"
          style={{ width: avatarSize, height: avatarSize }}
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
    );
  }

  const displayName = profile.displayName.trim() || t("hero.defaultName");
  const handle = profile.handle.trim()
    ? `@${profile.handle}`
    : `@user-${profile.userId.slice(0, 6)}`;
  const memberSince = t("hero.memberSince", {
    date: formatMemberSince(profile.createdAt, i18n.language),
  });

  const chips = [
    { key: "handle", value: handle },
    { key: "member", value: memberSince },
    { key: "country", value: profile.country ?? "" },
    // Show the human label ("3×3"), not the DB code ("333") — the code is
    // the internal puzzle_type (ADR-002), never user-facing.
    { key: "puzzle", value: puzzleTypeLabel(profile.mainPuzzle) },
    ...profile.declaredMethods.map((method) => ({ key: `method-${method}`, value: method })),
  ].filter((chip) => chip.value !== "");

  // Random color + variant per badge, rolled once per badge list.
  // Stable across re-renders, re-rolled only when the badge set changes.
  const badgeKey = badges.map((b) => b.puzzle).join(",");
  const badgeStyles = useMemo(
    () => badges.map(() => rollSubBadgeStyle()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [badgeKey],
  );

  return (
    <div
      data-onboarding-target="profile"
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-xl border border-line bg-surface p-5 sm:gap-6 sm:p-6",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
        {profile.avatarKind === "photo" && profile.avatarData ? (
          <img
            src={profile.avatarData}
            alt={t("hero.avatarAlt")}
            className="shrink-0 rounded-xl object-cover ring-1 ring-line shadow-sm"
            style={{ width: avatarSize, height: avatarSize }}
          />
        ) : (
          <IdenticonAvatar
            seed={seed ?? profile.userId}
            size={avatarSize}
            className="shrink-0 rounded-xl ring-1 ring-line shadow-sm"
          />
        )}
        {/* Mobile-only top edit button for quick tap */}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex sm:hidden shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-ink transition-all duration-150 hover:border-ink/30 hover:bg-surface-2 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          >
            <Pencil className="size-3.5" />
            {t("hero.edit")}
          </button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl lg:text-3xl">
              {displayName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-ink-3">
              {chips.map((chip, i) => (
                <span key={chip.key} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className="text-ink-3">·</span>}
                  {chip.key === "country" ? (
                    <CountryFlag country={chip.value} />
                  ) : (
                    <span className="whitespace-nowrap">{chip.value}</span>
                  )}
                </span>
              ))}
            </div>
            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5 py-0.5">
                {badges.slice(0, 6).map((badge, idx) => (
                  <Tooltip key={badge.puzzle}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <SubBadge badge={badge} style={badgeStyles[idx]} />
                      </span>
                    </TooltipTrigger>
                      {/* The claim in full: which average earned the badge and
                          what today's form is, so it is never read as "right
                          now" when it is a peak. */}
                      <TooltipContent side="top">
                        <div>
                          {t("hero.badgeTitle", {
                            puzzle: badge.puzzleLabel,
                            threshold: badge.thresholdLabel,
                          })}
                        </div>
                        <div className="mt-0.5 opacity-70">
                          {badge.windowSize === SUB_BADGE_WINDOW
                            ? t("hero.badgeFromAo100", {
                                average: formatTime(badge.averageMs),
                              })
                            : t("hero.badgeFromAo12", {
                                average: formatTime(badge.averageMs),
                              })}
                        </div>
                        {badge.currentMs !== null ? (
                          <div className="opacity-70">
                            {t("hero.badgeNow", {
                              average: formatTime(badge.currentMs),
                            })}
                          </div>
                        ) : null}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {badges.length > 6 && (
                  <SubBadgeOverflow count={badges.length - 6} />
                )}
              </div>
            )}
          </div>
          {/* Desktop/Tablet edit button */}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3.5 py-1.5 text-xs font-semibold text-ink transition-all duration-150 hover:border-ink/30 hover:bg-surface-2 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              <Pencil className="size-3.5" />
              {t("hero.edit")}
            </button>
          ) : null}
        </div>
        {profile.bio ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">{profile.bio}</p>
        ) : null}
      </div>
    </div>
  );
}
