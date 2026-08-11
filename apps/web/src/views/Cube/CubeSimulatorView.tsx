"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, RotateCcw, Shuffle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCube3D } from "@/hooks/useCube3D";
import { useCubeTurnControls } from "@/hooks/useCubeTurnControls";
import { CUBE_KEYMAP, actionToNotation, type CubeKeyAction } from "@/lib/keybinds/cubeKeybinds";
import { generateScrambleFor } from "@/utils/puzzleUtils";
import { compactMoveNotation } from "@cubeforge/math-core";

/** The simulator currently supports 3×3 (architecture ready for more puzzles). */
const CUBE_ORDER = 3;
/** Max moves shown in the bottom moves strip. */
const MAX_RECENT_MOVES = 12;

const kbdLabel = (code: string) =>
  code
    .replace("Key", "")
    .replace("Digit", "")
    .replace("Semicolon", ";")
    .replace("Comma", ",")
    .replace("Period", ".")
    .replace("Slash", "/");

const isSliceFace = (face: string) => face === "M" || face === "E" || face === "S";

/** Small key → move chip used in the controls overlay. */
function KeyChip({ code }: { code: string }) {
  return <kbd className="min-w-6 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center font-mono text-[0.65rem] font-semibold text-ink shadow-sm">{kbdLabel(code)}</kbd>;
}

export const CubeSimulatorView = memo(function CubeSimulatorView() {
  const { t } = useTranslation("cube");
  const { t: tCommon } = useTranslation();

  const {
    canvasRef,
    containerRef,
    isReady,
    initFailed,
    contextEvicted,
    reset,
    applyScramble,
    zoomCamera,
    engineRef,
  } = useCube3D({ order: CUBE_ORDER, connectSmartCube: false });

  const [scramble, setScramble] = useState<string>("");
  const [appliedScramble, setAppliedScramble] = useState<string | null>(null);
  const [recentMoves, setRecentMoves] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Scramble: generate on mount, apply automatically once the engine is ready ──
  useEffect(() => {
    setScramble(generateScrambleFor("3x3"));
  }, []);

  useEffect(() => {
    if (isReady && scramble && appliedScramble !== scramble) {
      setAppliedScramble(scramble);
      applyScramble(scramble);
      setRecentMoves([]);
    }
  }, [isReady, scramble, appliedScramble, applyScramble]);

  const handleNewScramble = useCallback(() => {
    setScramble(generateScrambleFor("3x3"));
  }, []);

  // ── Touch / keyboard controls ───────────────────────────────────────────
  const handleMove = useCallback((notation: string) => {
    setRecentMoves((prev) => compactMoveNotation([...prev, notation]).slice(-MAX_RECENT_MOVES));
  }, []);

  const { performAction, pointerHandlers } = useCubeTurnControls({
    engineRef,
    order: CUBE_ORDER,
    onMove: handleMove,
  });

  // csTimer-layout keyboard binding (only while this view is mounted).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept when an input/editable owns the keyboard, or when a
      // modifier is held (csTimer reserves Alt/Ctrl for global shortcuts).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.code === "Escape") {
        setShowHelp(false);
        return;
      }
      const action: CubeKeyAction | undefined = CUBE_KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      performAction(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performAction]);

  // ── Help overlay data (derived from the keymap — single source of truth) ──
  const helpGroups = useMemo(() => {
    const entries = Object.entries(CUBE_KEYMAP);
    const faces = entries.filter(([, a]) => a.kind === "turn" && !isSliceFace(a.face));
    const slices = entries.filter(([, a]) => a.kind === "turn" && isSliceFace(a.face));
    const wide = entries.filter(([, a]) => a.kind === "wide");
    const rotations = entries.filter(([, a]) => a.kind === "rotate");
    const toItems = (list: [string, CubeKeyAction][]) =>
      list.map(([code, action]) => ({ code, label: actionToNotation(action) }));
    return [
      { title: t("keys.faces"), items: toItems(faces) },
      { title: t("keys.rotations"), items: toItems(rotations) },
      { title: t("keys.wide"), items: toItems(wide) },
      { title: t("keys.slices"), items: toItems(slices) },
    ];
  }, [t]);

  const unavailable = initFailed || contextEvicted;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{t("title")}</h2>
          {!hintDismissed && (
            <div className="mt-0.5 flex items-center gap-2">
              <p className="truncate text-[0.68rem] text-ink-3">{t("gestureHint")}</p>
              <button
                type="button"
                onClick={() => setHintDismissed(true)}
                className="shrink-0 text-ink-3/60 transition-colors hover:text-ink"
                aria-label={tCommon("cancel")}
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewScramble}
                disabled={!isReady}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Shuffle className="size-3.5" />
                {t("newScramble")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("newScramble")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!isReady}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <RotateCcw className="size-3.5" />
                {t("reset")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("reset")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(true)}
                disabled={!isReady}
                className="h-8 gap-1.5 px-2.5 text-xs"
                aria-haspopup="dialog"
                aria-expanded={showHelp}
              >
                <HelpCircle className="size-3.5" />
                {t("help")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("helpShort")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={cn(
            "absolute inset-0 h-full w-full touch-none outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={(e) => {
            setIsDragging(true);
            pointerHandlers.onPointerDown(e);
          }}
          onPointerMove={pointerHandlers.onPointerMove}
          onPointerUp={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            setIsDragging(false);
            pointerHandlers.onPointerCancel(e);
          }}
          onWheel={(e) => {
            e.preventDefault();
            zoomCamera(e.deltaY);
          }}
        />

        {/* Loading / fallback states */}
        {unavailable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 px-4">
            <p className="select-none text-center text-xs text-ink-3/70">{t("unavailable")}</p>
          </div>
        ) : !isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
            <p className="animate-pulse select-none text-xs text-ink-3/50">{t("initializing")}</p>
          </div>
        ) : null}

        {/* Recent moves strip */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center bg-background/60 px-4 py-2 backdrop-blur-sm">
          {recentMoves.length === 0 ? (
            <p className="select-none text-[0.7rem] italic text-ink-3/60">
              {t("movesEmpty")}
            </p>
          ) : (
            <div
              className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 font-mono text-[0.8rem] font-semibold text-ink"
              role="log"
              aria-label={t("movesAria")}
            >
              {recentMoves.map((m, i) => (
                <span key={`${m}-${i}`} className="animate-in fade-in slide-in-from-right-2">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls overlay (help) */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setShowHelp(false);
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
              className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
            >
              <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                  <h3 id="cube-help-title" className="text-sm font-semibold text-ink">
                    {t("keys.title")}
                  </h3>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-3">{t("keys.subtitle")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)} className="h-7 px-1.5" aria-label={t("keys.close")}>
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {helpGroups.map((group) => (
                  <div key={group.title}>
                    <h4 className="mb-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-3">
                      {group.title}
                    </h4>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {group.items.map((item) => (
                        <span key={item.code} className="flex items-center gap-1.5 text-[0.7rem] text-ink-2">
                          <KeyChip code={item.code} />
                          <span className="font-mono font-semibold text-ink">{item.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 border-t border-line pt-3 text-[0.65rem] text-ink-3/80">{t("keys.footer")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
