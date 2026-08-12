"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Flat "+" tray button inside the dock that opens the manual solve sheet. */
export function ManualSolvePiece({ onAddManual }: { onAddManual?: () => void }) {
  const { t } = useTranslation("shell");

  if (!onAddManual) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onAddManual}
          aria-label={t("addManualSolve")}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("addManualSolve")}</TooltipContent>
    </Tooltip>
  );
}
