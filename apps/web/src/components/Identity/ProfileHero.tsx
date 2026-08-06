"use client";

import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { Profile } from "@cubeforge/database";
import { IdenticonAvatar } from "./IdenticonAvatar";
import { CountryFlag } from "./CountryFlag";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SubBadge } from "@/utils/subBadges";

/**
 * Rainbow badge styles per phase token for 3D sticker badges.
 * Outer background gives the 3D bottom rim color, matching the phase hue.
 */
const BADGE_COLOR_STYLES: Record<string, { bg: string }> = {
  "phase-blue": { bg: "bg-[#60a5fa]" },
  "phase-emerald": { bg: "bg-[#5cdb95]" },
  "phase-teal": { bg: "bg-[#2dd4bf]" },
  "phase-amber": { bg: "bg-[#fbbf24]" },
  "phase-violet": { bg: "bg-[#a78bfa]" },
  "phase-purple": { bg: "bg-[#c084fc]" },
  "phase-indigo": { bg: "bg-[#818cf8]" },
  "phase-rose": { bg: "bg-[#fb7185]" },
  "phase-cyan": { bg: "bg-[#22d3ee]" },
  "phase-orange": { bg: "bg-[#fb923c]" },
  "phase-sky": { bg: "bg-[#38bdf8]" },
  "phase-pink": { bg: "bg-[#f472b6]" },
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
  className?: string;
}

/** Empty-state fallback until the user edits their profile. */
const DEFAULT_DISPLAY_NAME = "Speedcuber";

function formatMemberSince(createdAt: number): string {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleDateString("en-US", {
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
  className,
}: ProfileHeroProps) {
  const isTouch = useIsTouch();
  const avatarSize = isTouch ? 80 : 112;

  if (loading || !profile) {
    return (
      <div
        className={cn(
          "flex items-center gap-5 rounded-2xl border border-line bg-surface p-5 sm:gap-6 sm:p-6",
          className,
        )}
      >
        <Skeleton
          className="shrink-0 rounded-2xl"
          style={{ width: avatarSize, height: avatarSize }}
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-6 w-44 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
    );
  }

  const displayName = profile.displayName.trim() || DEFAULT_DISPLAY_NAME;
  const handle = profile.handle.trim()
    ? `@${profile.handle}`
    : `@user-${profile.userId.slice(0, 6)}`;
  const memberSince = `Member since ${formatMemberSince(profile.createdAt)}`;

  const chips = [
    { key: "handle", value: handle },
    { key: "member", value: memberSince },
    { key: "country", value: profile.country ?? "" },
    { key: "puzzle", value: profile.mainPuzzle },
    ...profile.declaredMethods.map((method) => ({ key: `method-${method}`, value: method })),
  ].filter((chip) => chip.value !== "");

  return (
    <div
      data-onboarding-target="profile"
      className={cn(
        "flex items-start gap-5 rounded-2xl border border-line bg-surface p-5 sm:items-center sm:gap-6 sm:p-6",
        className,
      )}
    >
      {profile.avatarKind === "photo" && profile.avatarData ? (
        <img
          src={profile.avatarData}
          alt="Profile avatar"
          className="shrink-0 rounded-2xl object-cover ring-1 ring-line"
          style={{ width: avatarSize, height: avatarSize }}
        />
      ) : (
        <IdenticonAvatar
          seed={profile.userId}
          size={avatarSize}
          className="shrink-0 rounded-2xl ring-1 ring-line"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-ink sm:text-2xl">
              {displayName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
              {chips.map((chip, i) => (
                <span key={chip.key} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {chip.key === "country" ? (
                    <CountryFlag country={chip.value} />
                  ) : (
                    <span className="whitespace-nowrap">{chip.value}</span>
                  )}
                </span>
              ))}
            </div>
            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5 py-1">
                {badges.slice(0, 4).map((badge, idx) => {
                  const style =
                    BADGE_COLOR_STYLES[badge.color] ?? DEFAULT_BADGE_STYLE;
                  const rotation = BADGE_ROTATIONS[idx % BADGE_ROTATIONS.length];
                  return (
                    <span
                      key={badge.puzzle}
                      title={`PB ${badge.puzzleLabel} is Sub ${badge.thresholdLabel}`}
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
                  );
                })}
                {badges.length > 4 && (
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
                        +{badges.length - 4}
                      </span>
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-3 py-1.5 text-[0.7rem] font-medium text-ink-2 transition-all duration-150 hover:border-ink/30 hover:bg-surface-2 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          ) : null}
        </div>
        {profile.bio ? (
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-2">{profile.bio}</p>
        ) : null}
      </div>
    </div>
  );
}
