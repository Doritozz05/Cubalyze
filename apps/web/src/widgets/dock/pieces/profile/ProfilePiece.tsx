"use client";

import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Profile pill — quick access to user profile. */
export function ProfilePiece() {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t("common.profile")}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <User className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("common.profile")}</TooltipContent>
    </Tooltip>
  );
}
