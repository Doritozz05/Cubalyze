"use client";

/**
 * CollectionRail.tsx — the cinematic focus rail.
 *
 * EXPERIMENTAL (branch `exp/cube-collection`).
 *
 * A "cover flow" arrangement: the focused item sits flat and forward, its
 * neighbours recede into depth, rotate to face the centre, dim and lose focus.
 * The whole track is one shared spring, so changing focus reads as a camera
 * dolly rather than a list jumping — that is the entire point of the mode.
 *
 * Interaction: click a card, use ← / →, or the flanking arrows. No drag
 * physics yet (deliberate: it fights the keyboard for the same state).
 */

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GearGlyph } from "../GearGlyph";
import { KIND_I18N_KEY, type GearItem } from "../collectionModel";

/** Two steps behind the focus is where depth stops reading; clamp there. */
const MAX_VISIBLE = 4;

/** Shared spring: the "camera" easing for every item, so they move as a body. */
const RAIL_SPRING = { type: "spring", stiffness: 190, damping: 26, mass: 0.9 } as const;

const CARD_WIDTH = 188;
const CARD_ADVANCE = 176;
const DEPTH_STEP = 190;

interface CollectionRailProps {
  items: readonly GearItem[];
  /** Index of the focused item. */
  focus: number;
  onFocusChange: (index: number) => void;
}

export function CollectionRail({ items, focus, onFocusChange }: CollectionRailProps) {
  const { t } = useTranslation("collection");
  const canGoBack = focus > 0;
  const canGoForward = focus < items.length - 1;

  const step = (delta: number) => {
    const next = Math.min(items.length - 1, Math.max(0, focus + delta));
    if (next !== focus) onFocusChange(next);
  };

  return (
    <div className="relative flex-1">
      {/* Perspective lives on the viewport, not the track, so depth is camera
          depth rather than a per-item trick. */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1800px" }}
      >
        <div
          className="relative h-[360px] w-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          {items.map((item, index) => {
            const offset = index - focus;
            const depth = Math.min(Math.abs(offset), MAX_VISIBLE);
            const isFocused = offset === 0;
            const hidden = Math.abs(offset) > MAX_VISIBLE;

            return (
              <motion.button
                key={item.id}
                type="button"
                aria-label={item.name}
                aria-current={isFocused}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => onFocusChange(index)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
                style={{
                  width: CARD_WIDTH,
                  transformStyle: "preserve-3d",
                  pointerEvents: hidden ? "none" : "auto",
                }}
                initial={false}
                animate={{
                  x: offset * CARD_ADVANCE,
                  y: depth * 10,
                  z: -depth * DEPTH_STEP,
                  rotateY: Math.max(-3, Math.min(3, offset)) * 34,
                  scale: 1 - depth * 0.045,
                  opacity: hidden ? 0 : 1 - Math.abs(offset) * 0.17,
                  filter: `blur(${(depth * 1.1).toFixed(2)}px)`,
                }}
                transition={RAIL_SPRING}
              >
                <div
                  className={[
                    "flex flex-col items-center gap-3 rounded-2xl px-4 pb-4 pt-5 transition-colors duration-300",
                    isFocused
                      ? "border border-line bg-surface/70 shadow-[0_36px_70px_-34px_rgba(0,0,0,0.6)] ring-1 ring-line-2 backdrop-blur-md"
                      : "border border-transparent",
                  ].join(" ")}
                >
                  <div className="relative flex h-[168px] items-center justify-center">
                    {item.primary ? (
                      <span className="absolute -top-1 right-0 rounded-full bg-ink px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-canvas">
                        {t("primary")}
                      </span>
                    ) : null}
                    <GearGlyph item={item} size={150} />
                  </div>

                  <div className="w-full text-center">
                    <div className="truncate text-[0.82rem] font-medium text-ink">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-[0.68rem] uppercase tracking-wider text-ink-3">
                      {item.size ?? t(KIND_I18N_KEY[item.kind])}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <RailArrow
        side="left"
        disabled={!canGoBack}
        label={t("prev")}
        onClick={() => step(-1)}
      />
      <RailArrow
        side="right"
        disabled={!canGoForward}
        label={t("next")}
        onClick={() => step(1)}
      />
    </div>
  );
}

function RailArrow({
  side,
  disabled,
  label,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-line bg-surface/70 p-2 backdrop-blur-md transition",
        "hover:bg-surface disabled:cursor-default disabled:opacity-0",
        side === "left" ? "left-2" : "right-2",
      ].join(" ")}
    >
      <Icon className="size-4 text-ink-2" />
    </button>
  );
}
