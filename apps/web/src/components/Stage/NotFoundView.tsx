"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

/**
 * 404 stage rendered for paths that match no known view (e.g. /settings,
 * /foo). Keeps the shell alive (header/sidebar stay usable) while showing
 * an honest "not found" instead of silently rendering the timer under a
 * URL that doesn't match.
 */
export function NotFoundView({ onGoHome }: { onGoHome: () => void }) {
  const { t } = useTranslation("shell");
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-ink-3">
        <Compass className="size-7" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("notFoundTitle")}</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-3">
          {t("notFoundDescription")}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={onGoHome}
        className="border-line bg-surface text-ink hover:bg-surface-2"
      >
        {t("notFoundGoHome")}
      </Button>
    </div>
  );
}
