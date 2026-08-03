"use client";

import { Timer, BarChart3, Dumbbell, BookOpen, Network } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { ProfileHero } from "@/components/Identity/ProfileHero";
import type { ViewId } from "@/components/Layout/sidebar.constants";

interface QuickAction {
  id: ViewId;
  label: string;
  description: string;
  icon: React.ElementType;
}

/** Real navigation targets — every action leads to an existing view. */
const QUICK_ACTIONS: QuickAction[] = [
  { id: "timer", label: "Timer", description: "Start a new solve", icon: Timer },
  { id: "insights", label: "Stats", description: "View your solve statistics", icon: BarChart3 },
  { id: "training", label: "Training", description: "Drills, SRS review, challenges", icon: Dumbbell },
  { id: "practice", label: "Algorithms", description: "Browse and practice algorithms", icon: BookOpen },
  { id: "skill-tree", label: "Skills", description: "Skill tree progression", icon: Network },
];

export interface ProfileViewProps {
  onNavigate?: (view: ViewId) => void;
}

/**
 * F3 (docs/plan_profile) — the user's identity center.
 * Hero (B1) with the CubeMark identicon + real identity data; quick actions
 * navigate to existing views. Content blocks (B2–B4: stats strip, tabs) land
 * in F4 with their data hooks.
 */
export function ProfileView({ onNavigate }: ProfileViewProps) {
  const { profile, loading } = useProfile();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
        Profile
      </h1>

      <ProfileHero profile={profile} loading={loading} />

      <section className="mt-6">
        <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              className="group flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface p-4 text-left transition-all duration-150 hover:border-ink-2/40 hover:bg-surface-2 active:scale-[0.98] cursor-pointer"
            >
              <div className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-2 transition-colors group-hover:text-ink">
                <Icon className="size-[1.05rem]" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-ink">{label}</span>
                <span className="mt-0.5 block text-[0.65rem] leading-tight text-ink-3">
                  {description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
