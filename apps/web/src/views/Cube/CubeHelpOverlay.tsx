"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CUBE_KEYMAP,
  actionToNotation,
  isActionAllowedForOrder,
  type CubeKeyAction,
} from "@/lib/keybinds/cubeKeybinds";
import { pyraminxKeyToToken } from "@/lib/keybinds/pyraminxKeybinds";
import { preferencesStore } from "@cubeforge/state";

export type CubeTurnSpeed = "slow" | "normal" | "fast" | "instant";

/** i18n key for each turn-speed label (typed literals — no dynamic keys). */
const TURN_SPEED_LABEL_KEY: Record<
  CubeTurnSpeed,
  "keys.speedSlow" | "keys.speedNormal" | "keys.speedFast" | "keys.speedInstant"
> = {
  slow: "keys.speedSlow",
  normal: "keys.speedNormal",
  fast: "keys.speedFast",
  instant: "keys.speedInstant",
};

const TURN_SPEED_OPTIONS: CubeTurnSpeed[] = ["slow", "normal", "fast", "instant"];

/**
 * QWERTY layout of the physical keyboard, in order, for the on-screen key
 * map (mirrors virtual-cube.net's "Show Keyboard Map").
 */
const KEYBOARD_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

const PUNCT_CODES: Record<string, string> = {
  ";": "Semicolon",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
};

const labelToCode = (label: string): string =>
  /^[a-z]$/.test(label)
    ? `Key${label.toUpperCase()}`
    : /^\d$/.test(label)
      ? `Digit${label}`
      : (PUNCT_CODES[label] ?? "");

/** Arrow cluster (whole-cube rotations, like virtual-cube's bottom row). */
const ARROW_KEYS: { code: string; label: string }[] = [
  { code: "ArrowLeft", label: "←" },
  { code: "ArrowUp", label: "↑" },
  { code: "ArrowRight", label: "→" },
  { code: "ArrowDown", label: "↓" },
];

/**
 * Every keycap the help overlay can show, in QWERTY order (rows first, then
 * the arrow cluster). The render filters it per cube order so the 2×2 help
 * only lists moves that exist on a 2×2 (no slices, no wide moves).
 */
const HELP_KEYCAPS: { label: string; action: CubeKeyAction }[] = (() => {
  const caps: { label: string; action: CubeKeyAction }[] = [];
  for (const row of KEYBOARD_ROWS) {
    for (const label of row) {
      const action = CUBE_KEYMAP[labelToCode(label)];
      if (action) caps.push({ label, action });
    }
  }
  for (const k of ARROW_KEYS) {
    const action = CUBE_KEYMAP[k.code];
    if (action) caps.push({ label: k.label, action });
  }
  return caps;
})();

/**
 * Pyraminx keycaps: the SAME QWERTY rows scanned through PYRAMINX_KEYMAP —
 * only keys bound to a WCA token (8 layer + 8 tip turns) appear, in keyboard
 * order. Arrows are whole-puzzle rotations handled by the view (not part of
 * the keymap), rendered as its own cluster below.
 */
const PYRAMINX_HELP_KEYCAPS: { label: string; token: string }[] = (() => {
  const caps: { label: string; token: string }[] = [];
  for (const row of KEYBOARD_ROWS) {
    for (const label of row) {
      const token = pyraminxKeyToToken(labelToCode(label));
      if (token) caps.push({ label, token });
    }
  }
  return caps;
})();

/** A single keycap in the on-screen keyboard: key label on top, move below. */
function KeyCap({ label, notation, dim }: { label: string; notation?: string; dim?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-8 shrink-0 select-none flex-col items-center rounded-md border border-line bg-surface px-0.5 py-1 shadow-xs",
        dim && "opacity-25",
      )}
    >
      <span className="text-[0.55rem] leading-none font-medium text-ink-3">{label}</span>
      <span className="mt-1 font-mono text-[0.62rem] leading-none font-semibold text-ink">
        {notation ?? "·"}
      </span>
    </div>
  );
}

export interface CubeHelpOverlayProps {
  showHelp: boolean;
  /** Cube order (2 or 3): the 2×2 help lists only moves that exist on a 2×2.
   *  Ignored (and optional) in pyraminx mode. */
  order?: number;
  /** Pyraminx mode: the same overlay with the pyraminx keymap + gestures. */
  pyraminx?: boolean;
  onClose: () => void;
}

/** The Cube tab's controls overlay — on-screen keyboard map, turn speed and
 *  gesture legend (like virtual-cube.net's "Show Keyboard Map"). The same
 *  overlay serves the Pyraminx view (`pyraminx`): identical dialog, the
 *  pyraminx keymap + gestures instead of the cube's. */
export function CubeHelpOverlay({ showHelp, order, pyraminx, onClose }: CubeHelpOverlayProps) {
  const { t } = useTranslation("cube");
  const cubeTurnSpeed = useStore(preferencesStore, (s) => s.cubeTurnSpeed);
  const setCubeTurnSpeed = useStore(preferencesStore, (s) => s.setCubeTurnSpeed);

  return (
    <AnimatePresence>
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cube-help-title"
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-sm"
          >
            <div className="mb-1 flex items-start justify-between gap-4">
              <div>
                <h3 id="cube-help-title" className="text-sm font-semibold text-ink">
                  {t("keys.title")}
                </h3>
                <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-3">
                  {t(
                    pyraminx
                      ? "keys.subtitlePyraminx"
                      : order === 2
                        ? "keys.subtitle2x2"
                        : "keys.subtitle",
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 px-1.5"
                aria-label={t("keys.close")}
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* On-screen keyboard — each keycap shows its move. Pyraminx
                mode: the same QWERTY keycaps showing the pyraminx tokens
                (layer turns + tip turns), arrow cluster for the whole-puzzle
                rotation. The 2×2 help lists ONLY the moves that exist on a
                2×2 (face turns + whole-cube rotations — no slices, no wide
                moves). */}
            {pyraminx ? (
              <div className="mt-4 flex flex-col items-center gap-1.5">
                {KEYBOARD_ROWS.map((row) => (
                  <div key={row[0]} className="flex gap-1">
                    {row.map((label) => {
                      const cap = PYRAMINX_HELP_KEYCAPS.find((c) => c.label === label);
                      return (
                        <KeyCap
                          key={label}
                          label={label}
                          notation={cap?.token}
                          dim={!cap}
                        />
                      );
                    })}
                  </div>
                ))}
                {/* Arrow cluster — whole-puzzle rotations (camera stays locked) */}
                <div className="mt-1 flex gap-1">
                  {ARROW_KEYS.map((k) => (
                    <KeyCap key={k.code} label={k.label} />
                  ))}
                </div>
              </div>
            ) : order === 2 ? (
              <div className="mt-4 flex max-w-md flex-wrap items-center justify-center gap-1.5">
                {HELP_KEYCAPS.filter(({ action }) =>
                  isActionAllowedForOrder(action, 2),
                ).map(({ label, action }) => (
                  <KeyCap
                    key={label}
                    label={label}
                    notation={actionToNotation(action)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-1.5">
                {KEYBOARD_ROWS.map((row) => (
                  <div key={row[0]} className="flex gap-1">
                    {row.map((label) => {
                      const code = labelToCode(label);
                      const action = CUBE_KEYMAP[code];
                      return (
                        <KeyCap
                          key={label}
                          label={label}
                          notation={action ? actionToNotation(action) : undefined}
                          dim={!action}
                        />
                      );
                    })}
                  </div>
                ))}
                {/* Arrow cluster — whole-cube rotations (camera stays locked) */}
                <div className="mt-1 flex gap-1">
                  {ARROW_KEYS.map((k) => {
                    const action = CUBE_KEYMAP[k.code];
                    return (
                      <KeyCap
                        key={k.code}
                        label={k.label}
                        notation={action ? actionToNotation(action) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Turn speed */}
              <div>
                <h4 className="mb-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("keys.speed")}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {TURN_SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setCubeTurnSpeed(speed)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[0.68rem] font-medium transition-colors",
                        cubeTurnSpeed === speed
                          ? "border-primary bg-primary/10 text-ink"
                          : "border-line bg-background/40 text-ink-3 hover:border-ink-2/50 hover:text-ink",
                      )}
                      aria-pressed={cubeTurnSpeed === speed}
                    >
                      {t(TURN_SPEED_LABEL_KEY[speed])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gestures */}
              <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                <h4 className="mb-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-3">
                  {t("keys.gestures")}
                </h4>
                <ul className="space-y-1 text-[0.7rem] leading-relaxed text-ink-2">
                  <li>• {t(pyraminx ? "keys.pyraminxGestureDrag" : "keys.gestureSwipe")}</li>
                  <li>• {t("keys.gestureOrbit")}</li>
                  <li>• {t(pyraminx ? "keys.pyraminxGestureTap" : "keys.gestureTap")}</li>
                  <li>• {t("keys.gesturePinch")}</li>
                </ul>
              </div>
            </div>

            <p className="mt-4 border-t border-line pt-3 text-[0.65rem] text-ink-3/80">
              {t("keys.footer")}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
