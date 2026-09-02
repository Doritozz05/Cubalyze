"use client";

import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@cubeforge/database";
import { IdenticonAvatar } from "./IdenticonAvatar";
import { CountryFlag } from "./CountryFlag";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SubBadge } from "@/utils/subBadges";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";

/**
 * Rainbow badge styles per phase token for 3D sticker badges.
 * Outer background gives the 3D bottom rim color, matching the phase hue.
 */
const BADGE_COLOR_STYLES: Record<string, { bg: string }> = {
  "phase-blue": { bg: "bg-phase-blue" },
  "phase-emerald": { bg: "bg-phase-emerald" },
  "phase-teal": { bg: "bg-phase-teal" },
  "phase-amber": { bg: "bg-phase-amber" },
  "phase-violet": { bg: "bg-phase-violet" },
  "phase-purple": { bg: "bg-phase-purple" },
  "phase-indigo": { bg: "bg-phase-indigo" },
  "phase-rose": { bg: "bg-phase-rose" },
  "phase-cyan": { bg: "bg-phase-cyan" },
  "phase-orange": { bg: "bg-phase-orange" },
  "phase-sky": { bg: "bg-phase-sky" },
  "phase-pink": { bg: "bg-phase-pink" },
};

const DEFAULT_BADGE_STYLE = BADGE_COLOR_STYLES["phase-emerald"];
const BADGE_ROTATIONS = [-3, 3, -2, 4];

export interface ProfileHeroProps {
  profile: Profile | null;
  loading?: boolean;
  /** Opens the Profile editor (Settings → Profile). */
  onEdit?: () => void;
  /** Sub-X milestone badges derived from the PB per puzzle (e.g. "Sub 5 · 3×3"). */
  badges?: SubBadge[];
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
                {badges.slice(0, 6).map((badge, idx) => {
                  const style =
                    BADGE_COLOR_STYLES[badge.color] ?? DEFAULT_BADGE_STYLE;
                  const rotation = BADGE_ROTATIONS[idx % BADGE_ROTATIONS.length];
                  return (
                    <Tooltip key={badge.puzzle}>
                      <TooltipTrigger asChild>
                        <span
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: "center",
                            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                          }}
                          className={cn(
                            "group relative inline-block p-0 border-none pb-0.75 rounded-[6px] shadow-[0_2px_0_#494a4b] cursor-default select-none",
                            "hover:rotate-0 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_4px_0_#494a4b]",
                            "active:translate-y-0.5 active:pb-px active:shadow-[0_1px_0_#494a4b]",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute inset-0 rounded-[6px] dark:scale-[0.985]",
                              style.bg,
                            )}
                            aria-hidden="true"
                          />
                          <span className="relative flex items-baseline gap-1 rounded-[5px] border-2 border-[#494a4b] bg-[#f1f5f8] px-2.5 py-1 text-xs font-semibold leading-none text-[#1e293b] whitespace-nowrap">
                            <span className="nums">Sub {badge.thresholdLabel}</span>
                            <span className="opacity-75">{badge.puzzleLabel}</span>
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t("hero.pbTitle", {
                          puzzle: badge.puzzleLabel,
                          threshold: badge.thresholdLabel,
                        })}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {badges.length > 6 && (
                  <span
                    style={{
                      transform: "rotate(2deg)",
                      transformOrigin: "center",
                      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                    }}
                    className="group relative inline-block p-0 border-none pb-0.75 rounded-[6px] shadow-[0_2px_0_#494a4b] cursor-default select-none hover:rotate-0 hover:scale-105 hover:-translate-y-1"
                  >
                    <span
                      className="absolute inset-0 rounded-[6px] bg-slate-300 dark:scale-[0.985]"
                      aria-hidden="true"
                    />
                    <span className="relative flex items-center rounded-[5px] border-2 border-[#494a4b] bg-[#f1f5f8] px-2.5 py-1 text-xs font-semibold leading-none text-[#1e293b]">
                      <span className="nums">
                        +{badges.length - 6}
                      </span>
                    </span>
                  </span>
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
