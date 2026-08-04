"use client";

import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { Profile } from "@cubeforge/database";
import { IdenticonAvatar } from "./IdenticonAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SubBadge } from "@/utils/subBadges";

/**
 * Rainbow badge styles per phase token (static strings so Tailwind sees the
 * full class names). Solid colored text + semi-transparent tinted background,
 * no border and no dot — same palette family as the CFOP timeline dots.
 */
const BADGE_COLOR_STYLES: Record<string, { pill: string; text: string }> = {
  "phase-blue": { pill: "bg-phase-blue/15", text: "text-phase-blue" },
  "phase-emerald": { pill: "bg-phase-emerald/15", text: "text-phase-emerald" },
  "phase-teal": { pill: "bg-phase-teal/15", text: "text-phase-teal" },
  "phase-amber": { pill: "bg-phase-amber/15", text: "text-phase-amber" },
  "phase-violet": { pill: "bg-phase-violet/15", text: "text-phase-violet" },
  "phase-purple": { pill: "bg-phase-purple/15", text: "text-phase-purple" },
  "phase-indigo": { pill: "bg-phase-indigo/15", text: "text-phase-indigo" },
  "phase-rose": { pill: "bg-phase-rose/15", text: "text-phase-rose" },
  "phase-cyan": { pill: "bg-phase-cyan/15", text: "text-phase-cyan" },
  "phase-orange": { pill: "bg-phase-orange/15", text: "text-phase-orange" },
  "phase-sky": { pill: "bg-phase-sky/15", text: "text-phase-sky" },
  "phase-pink": { pill: "bg-phase-pink/15", text: "text-phase-pink" },
};

const DEFAULT_BADGE_STYLE = BADGE_COLOR_STYLES["phase-blue"];

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
    { key: "puzzle", value: profile.mainPuzzle },
    ...profile.declaredMethods.map((method) => ({ key: `method-${method}`, value: method })),
  ];

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
                  <span className="whitespace-nowrap">{chip.value}</span>
                </span>
              ))}
            </div>
            {badges.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {badges.slice(0, 4).map((badge) => {
                  const style =
                    BADGE_COLOR_STYLES[badge.color] ?? DEFAULT_BADGE_STYLE;
                  return (
                    <span
                      key={badge.puzzle}
                      title={`PB ${badge.puzzleLabel} is Sub ${badge.thresholdLabel}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.65rem] font-semibold nums",
                        style.pill,
                        style.text,
                      )}
                    >
                      Sub {badge.thresholdLabel}
                      <span aria-hidden="true" className="opacity-60">
                        ·
                      </span>
                      <span className="font-sans tracking-normal">
                        {badge.puzzleLabel}
                      </span>
                    </span>
                  );
                })}
                {badges.length > 4 && (
                  <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[0.65rem] font-medium text-ink-3">
                    +{badges.length - 4}
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
