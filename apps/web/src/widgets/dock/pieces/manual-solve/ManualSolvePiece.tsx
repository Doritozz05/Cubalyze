"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * "+" button that opens the manual solve sheet.
 * Follows the standard dock piece pattern: transparent icon-only pill at rest,
 * frosted hover chip on interaction (liquid glass engine handles the chip via
 * hover:bg-surface-2 → --glass-btn-bg-hover).
 */
export function ManualSolvePiece({
  onAddManual,
}: {
  onAddManual?: () => void;
}) {
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
