"use client";

import { useState } from "react";
import { Zap, Moon, Flame, Wand2, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreativeBadgeItem {
  id: string;
  subText: string;
  creativeLabel: string;
  title: string;
  description: string;
  bgClass: string;
  iconColor: string;
  icon: React.ElementType;
  rotation: number;
}

export const MOCK_HARMONIOUS_BADGES: CreativeBadgeItem[] = [
  {
    id: "sub-5-lightning",
    subText: "5",
    creativeLabel: "Lightning",
    title: "Lightning Reflexes",
    description: "Ultra-fast sub-5 solves with lightspeed finger trick execution.",
    bgClass: "bg-[#22d3ee]", // phase-cyan
    iconColor: "text-[#0284c7]",
    icon: Zap,
    rotation: -3,
  },
  {
    id: "sub-10-night-owl",
    subText: "10",
    creativeLabel: "Night Owl",
    title: "Night Owl",
    description: "High-focus speedcubing session completed at 3:00 AM.",
    bgClass: "bg-[#c084fc]", // phase-purple
    iconColor: "text-[#7e22ce]",
    icon: Moon,
    rotation: 3,
  },
  {
    id: "sub-12-flow",
    subText: "12",
    creativeLabel: "Flow State",
    title: "Zen Master",
    description: "Flawless lookahead with zero pause between F2L pairs and Last Layer.",
    bgClass: "bg-[#5cdb95]", // phase-emerald
    iconColor: "text-[#059669]",
    icon: Flame,
    rotation: -2,
  },
  {
    id: "sub-15-oh-wizard",
    subText: "15",
    creativeLabel: "OH Wizard",
    title: "One-Handed Wizard",
    description: "Surgical single-handed turns without hesitations or lockups.",
    bgClass: "bg-[#fb923c]", // phase-orange
    iconColor: "text-[#ea580c]",
    icon: Wand2,
    rotation: 4,
  },
  {
    id: "sub-20-blind",
    subText: "20",
    creativeLabel: "Blind Oracle",
    title: "Blindfold Oracle",
    description: "Flawless memory and blind execution with mathematical precision.",
    bgClass: "bg-[#fbbf24]", // phase-amber
    iconColor: "text-[#b45309]",
    icon: EyeOff,
    rotation: -1,
  },
];

/**
 * CreativeBadgePill
 * Uses the EXACT same 3D sticker architecture, borders, shadows, rotations, and colors
 * as the user's existing PB badges so that everything is 100% cohesive and seamless.
 */
export function CreativeBadgePill({ badge }: { badge: CreativeBadgeItem }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = badge.icon;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        style={{
          transform: `rotate(${badge.rotation}deg)`,
          transformOrigin: "center",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
        className={cn(
          "group relative inline-block p-0 border-none pb-0.75 rounded-[6px] shadow-[0_2px_0_#494a4b] cursor-pointer select-none",
          "hover:rotate-0 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_4px_0_#494a4b]",
          "active:translate-y-0.5 active:pb-px active:shadow-[0_1px_0_#494a4b]",
        )}
      >
        {/* Outer 3D Rim Color matching app phase tokens */}
        <span
          className={cn(
            "absolute inset-0 rounded-[6px] dark:scale-[0.985]",
            badge.bgClass,
          )}
          aria-hidden="true"
        />

        {/* Inner Content Badge matching existing PB badge style */}
        <span className="relative flex items-center gap-1 rounded-[5px] border-2 border-[#494a4b] bg-[#f1f5f8] px-2.5 py-1 text-xs font-semibold leading-none text-[#1e293b] whitespace-nowrap">
          <Icon className={cn("size-3 shrink-0", badge.iconColor)} />
          <span className="nums">Sub {badge.subText}</span>
          <span className="opacity-75">· {badge.creativeLabel}</span>
        </span>
      </span>

      {/* Hover Tooltip Card */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 shadow-lg animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-1.5 border-b border-line pb-1">
            <span className={cn("size-2 rounded-full", badge.bgClass)} />
            <span className="text-xs font-bold text-ink">{badge.title}</span>
          </div>
          <p className="mt-1 text-[0.65rem] leading-snug text-ink-3">
            {badge.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function MockAchievementBadgesList() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 py-1">
      {MOCK_HARMONIOUS_BADGES.map((badge) => (
        <CreativeBadgePill key={badge.id} badge={badge} />
      ))}
    </div>
  );
}
