"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** "+" button that opens the manual solve sheet. */
export function ManualSolvePiece({
  onAddManual,
  variant = "tray",
}: {
  onAddManual?: () => void;
  /** "tray" = flat round item in the desktop dock; "chip" = bordered box for the touch header. */
  variant?: "tray" | "chip";
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
          className={cn(
            "grid size-8 shrink-0 cursor-pointer place-items-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
            variant === "chip" ? "rounded-md border border-line bg-surface" : "rounded-full",
          )}
        >
          <Plus className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("addManualSolve")}</TooltipContent>
    </Tooltip>
  );
}
