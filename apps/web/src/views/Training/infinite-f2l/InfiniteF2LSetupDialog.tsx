"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Infinity as InfinityIcon, Play, Palette, Layers, Box, ShieldCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { CrossColor, F2LSlotId, InfiniteF2LOptions } from "./infiniteF2lEngine";

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
  const [allowedSlots, setAllowedSlots] = useState<F2LSlotId[]>(initialOptions?.allowedSlots ?? ["FR", "FL", "BL", "BR"]);
  const [allowTrapped, setAllowTrapped] = useState<boolean>(initialOptions?.allowTrapped ?? true);

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
      allowedSlots,
      allowTrapped,
      enableSound: false,
    });
    onOpenChange(false);
  };

  const content = (
    <div className="flex flex-col gap-6 p-6 max-sm:p-4">
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
                  "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all cursor-pointer",
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
                  "flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all cursor-pointer",
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

      {/* 3. Slot Filter & Trapped Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Slot selector */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
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
                    "flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer",
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

        {/* Trapped pieces mode */}
        <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-line bg-surface p-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="size-4 shrink-0 text-ink-3" />
              <div className="flex flex-col">
                <span className="text-[0.78rem] font-semibold text-ink">{t("infiniteF2l.setup.allowTrapped")}</span>
                <span className="text-[0.68rem] text-ink-3">{t("infiniteF2l.setup.allowTrappedHint")}</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={allowTrapped}
              onChange={(e) => setAllowTrapped(e.target.checked)}
              className="size-4 rounded accent-ink cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Start Button */}
      <div className="pt-2">
        <Button
          type="button"
          onClick={handleStart}
          className="w-full h-11 gap-2 rounded-xl bg-ink text-surface font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Play className="size-4 fill-current" />
          {t("infiniteF2l.setup.start")}
        </Button>
      </div>
    </div>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] bg-surface">
          <DrawerHeader className="border-b border-line px-6 py-4">
            <DrawerTitle className="flex items-center gap-2 text-base font-semibold text-ink">
              <InfinityIcon className="size-5 text-ink" />
              {t("infiniteF2l.title")}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-ink-3">
              {t("infiniteF2l.subtitle")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-line bg-surface/95 backdrop-blur-md p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="border-b border-line px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <InfinityIcon className="size-5 text-ink" />
            {t("infiniteF2l.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {t("infiniteF2l.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[80vh]">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
