"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Infinity as InfinityIcon, Play, Palette, Layers, Box, ShieldCheck, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useIsTouch } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  CrossColor,
  F2LSlotId,
  InfiniteF2LOptions,
  SpawnMode,
} from "./infiniteF2lEngine";

export interface InfiniteF2LSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOptions?: InfiniteF2LOptions;
  onStart: (options: Required<InfiniteF2LOptions>) => void;
}

const CROSS_COLORS: { id: CrossColor; labelKey: ParseKeys<"training">; color: string; bgClass: string }[] = [
  { id: "white", labelKey: "infiniteF2l.crossColors.white", color: "#ffffff", bgClass: "bg-white border-zinc-300 dark:border-zinc-700" },
  { id: "yellow", labelKey: "infiniteF2l.crossColors.yellow", color: "#eab308", bgClass: "bg-amber-400" },
  { id: "green", labelKey: "infiniteF2l.crossColors.green", color: "#22c55e", bgClass: "bg-emerald-500" },
  { id: "blue", labelKey: "infiniteF2l.crossColors.blue", color: "#3b82f6", bgClass: "bg-blue-500" },
  { id: "red", labelKey: "infiniteF2l.crossColors.red", color: "#ef4444", bgClass: "bg-rose-500" },
  { id: "orange", labelKey: "infiniteF2l.crossColors.orange", color: "#f97316", bgClass: "bg-orange-500" },
];

const SLOTS: { id: F2LSlotId; label: string }[] = [
  { id: "FR", label: "FR" },
  { id: "FL", label: "FL" },
  { id: "BL", label: "BL" },
  { id: "BR", label: "BR" },
];

export function InfiniteF2LSetupDialog({
  open,
  onOpenChange,
  initialOptions,
  onStart,
}: InfiniteF2LSetupDialogProps) {
  const { t } = useTranslation("training");
  const isTouch = useIsTouch();

  const [crossColor, setCrossColor] = useState<CrossColor>(initialOptions?.crossColor ?? "white");
  const [concurrentPairs, setConcurrentPairs] = useState<number>(initialOptions?.concurrentPairs ?? 2);
  const [targetPairs, setTargetPairs] = useState<number>(initialOptions?.targetPairs ?? 0);
  const [allowedSlots, setAllowedSlots] = useState<F2LSlotId[]>(initialOptions?.allowedSlots ?? ["FR", "FL", "BL", "BR"]);
  const [allowTrapped, setAllowTrapped] = useState<boolean>(initialOptions?.allowTrapped ?? true);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>(initialOptions?.spawnMode ?? "normal");
  const [aufEnabled, setAufEnabled] = useState<boolean>(initialOptions?.aufEnabled ?? true);

  const toggleSlot = (slotId: F2LSlotId) => {
    setAllowedSlots((prev) => {
      if (prev.includes(slotId)) {
        if (prev.length <= 1) return prev; // Keep at least one slot
        return prev.filter((s) => s !== slotId);
      } else {
        return [...prev, slotId];
      }
    });
  };

  const handleStart = () => {
    onStart({
      crossColor,
      concurrentPairs,
      targetPairs,
      allowedSlots,
      allowTrapped,
      enableSound: false,
      spawnMode,
      aufEnabled,
    });
    onOpenChange(false);
  };

  const SPAWN_MODES: { id: SpawnMode; labelKey: string }[] = [
    { id: "normal", labelKey: "infiniteF2l.setup.spawnModeNormal" },
    { id: "basic", labelKey: "infiniteF2l.setup.spawnModeBasic" },
    { id: "advanced", labelKey: "infiniteF2l.setup.spawnModeAdvanced" },
  ];

  const content = (
    <div className="flex flex-col gap-4 p-5 max-sm:p-4">
      {/* 1. Cross Color Picker */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-ink-3" />
          <span className="text-[0.82rem] font-semibold text-ink">{t("infiniteF2l.setup.crossColor")}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CROSS_COLORS.map((c) => {
            const isSelected = crossColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCrossColor(c.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all cursor-pointer",
                  isSelected
                    ? "border-ink bg-surface-2 ring-1 ring-ink/20 shadow-xs"
                    : "border-line bg-surface hover:bg-surface-2/60 text-ink-2",
                )}
              >
                <span className={cn("size-6 rounded-full border shadow-inner", c.bgClass)} />
                <span className="text-[0.72rem] font-medium truncate w-full">{t(c.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2 + 2b. Two-column on md+ (pairs | case pool), stacked when narrow */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 2. Number of Pairs */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-ink-3" />
            <span className="text-[0.82rem] font-semibold text-ink">{t("infiniteF2l.setup.concurrentPairs")}</span>
          </div>
          <span className="nums rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink">
            {concurrentPairs} {concurrentPairs === 1 ? t("infiniteF2l.setup.pairUnitSingular") : t("infiniteF2l.setup.pairUnitPlural")}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((num) => {
            const isSelected = concurrentPairs === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setConcurrentPairs(num)}
                className={cn(
                  "flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition-all cursor-pointer",
                  isSelected
                    ? "border-ink bg-ink text-surface shadow-xs"
                    : "border-line bg-surface hover:bg-surface-2 text-ink-2",
                )}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2b. Case Pool (spawn mode) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-ink-3" />
          <span className="text-[0.82rem] font-semibold text-ink">{t("infiniteF2l.setup.spawnMode")}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SPAWN_MODES.map((m) => {
            const isSelected = spawnMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSpawnMode(m.id)}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[0.78rem] font-semibold transition-all cursor-pointer",
                  isSelected
                    ? "border-ink bg-ink text-surface shadow-xs"
                    : "border-line bg-surface hover:bg-surface-2 text-ink-2",
                )}
              >
                {t(m.labelKey as never)}
              </button>
            );
          })}
        </div>

      </div>
      </div>

      {/* 3 + 4. Two-column on md+ (target goal | AUF), stacked when narrow —
          same height in both columns so the row reads balanced. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Target Goal (Target Pairs Slider) */}
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-ink-3" />
            <span className="text-[0.82rem] font-semibold text-ink">{t("infiniteF2l.setup.targetGoal")}</span>
          </div>
          <span className="nums rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
            {targetPairs === 0 ? `∞ ${t("infiniteF2l.setup.infiniteMode")}` : `${targetPairs} ${t("infiniteF2l.setup.pairUnitPlural")}`}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-3 font-semibold">∞</span>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={targetPairs}
              onChange={(e) => setTargetPairs(Number(e.target.value))}
              className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-ink"
            />
            <span className="text-xs text-ink-3 font-semibold">100</span>
          </div>
          {/* Quick presets */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {[0, 10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetPairs(preset)}
                className={cn(
                  "flex h-7 items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer",
                  targetPairs === preset
                    ? "bg-ink text-surface font-semibold shadow-xs"
                    : "bg-surface-2/70 text-ink-3 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {preset === 0 ? "∞" : `${preset}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AUF switch — right column of the target row, stretched to the same
          height (content centered) so both cards read as one balanced row. */}
      <div className="flex h-full flex-col justify-center gap-2 rounded-xl border border-line bg-surface p-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="size-4 shrink-0 text-ink-3" />
            <div className="flex flex-col">
              <span className="text-[0.78rem] font-semibold text-ink">{t("infiniteF2l.setup.aufEnabled")}</span>
              <span className="text-[0.68rem] text-ink-3">{t("infiniteF2l.setup.aufEnabledHint")}</span>
            </div>
          </div>
          <Switch
            checked={aufEnabled}
            onCheckedChange={setAufEnabled}
            aria-label={t("infiniteF2l.setup.aufEnabled")}
          />
        </label>
      </div>
      </div>

      {/* 5. Slot Filter & Trapped Options — side by side on md+ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Slot selector */}
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <Box className="size-4 text-ink-3" />
            <span className="text-[0.78rem] font-semibold text-ink">{t("infiniteF2l.setup.activeSlots")}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SLOTS.map((s) => {
              const isActive = allowedSlots.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSlot(s.id)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "border-ink/30 bg-surface-2 text-ink font-semibold"
                      : "border-line/60 bg-transparent text-ink-3 opacity-60 hover:opacity-100",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Trapped pieces mode — only the random (normal) injector consults
            it; the case pools define their own configurations, so the toggle
            is disabled (grayed) outside Normal to avoid implying it works. */}
        <div
          className={cn(
            "flex flex-col justify-center gap-1.5 rounded-xl border border-line bg-surface p-3 transition-opacity",
            spawnMode !== "normal" && "opacity-60",
          )}
        >
          <label
            className={cn(
              "flex items-center justify-between gap-3 select-none",
              spawnMode !== "normal" ? "cursor-not-allowed" : "cursor-pointer",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="size-4 shrink-0 text-ink-3" />
              <div className="flex flex-col">
                <span className="text-[0.78rem] font-semibold text-ink">{t("infiniteF2l.setup.allowTrapped")}</span>
                <span className="text-[0.68rem] text-ink-3">{t("infiniteF2l.setup.allowTrappedHint")}</span>
              </div>
            </div>
            <Switch
              checked={allowTrapped}
              disabled={spawnMode !== "normal"}
              onCheckedChange={setAllowTrapped}
              aria-label={t("infiniteF2l.setup.allowTrapped")}
              className="disabled:cursor-not-allowed"
            />
          </label>
          {spawnMode !== "normal" && (
            <p className="text-[0.65rem] leading-4 text-ink-3/80">
              {t("infiniteF2l.setup.allowTrappedOnlyNormal")}
            </p>
          )}
        </div>
      </div>

    </div>
  );

  // Start button — rendered in a FIXED footer outside the scroll area so it
  // is always visible, never hidden below the fold.
  const startButton = (
    <Button
      type="button"
      onClick={handleStart}
      className="w-full h-11 gap-2 rounded-xl bg-ink text-surface font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
    >
      <Play className="size-4 fill-current" />
      {t("infiniteF2l.setup.start")}
    </Button>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[90vh] flex-col bg-surface">
          <DrawerHeader className="shrink-0 border-b border-line px-6 py-4 max-sm:px-4">
            <DrawerTitle className="flex items-center gap-2 text-base font-semibold text-ink">
              <InfinityIcon className="size-5 text-ink" />
              {t("infiniteF2l.title")}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-ink-3">
              {t("infiniteF2l.subtitle")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
          {/* Fixed footer — the Start button is never hidden behind the scroll. */}
          <div className="shrink-0 border-t border-line px-6 py-3.5 max-sm:px-4">
            {startButton}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same professional panel as the app SettingsDialog: wide (960px),
          solid surface (no transparency), full height with internal scroll. */}
      <DialogContent className="flex flex-col sm:max-w-[960px] h-145 max-h-[85vh] max-lg:h-[85vh] overflow-hidden p-0 bg-surface text-ink border-line shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-line px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <InfinityIcon className="size-5 text-ink" />
            {t("infiniteF2l.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {t("infiniteF2l.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        {/* Fixed footer — the Start button is never hidden behind the scroll. */}
        <div className="shrink-0 border-t border-line px-6 py-3.5">
          {startButton}
        </div>
      </DialogContent>
    </Dialog>
  );
}
