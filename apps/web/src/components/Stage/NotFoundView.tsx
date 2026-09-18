"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { markAppReady } from "@/boot/appReady";

/**
 * Full standalone 404 page rendered for paths that match no known view
 * (e.g. /settings, /foo). Deliberately rendered OUTSIDE the app shell —
 * no header, no sidebar, no dock, no widgets — just the brand, a clear
 * message and a way back to the timer.
 */
export function NotFoundView() {
  const { t } = useTranslation("shell");
  const { t: tMeta } = useTranslation("meta");
  const location = useLocation();
  const navigate = useNavigate();

  useDocumentTitle(tMeta("notFound"));

  // The 404 is rendered OUTSIDE the shell and is not a lazy view, so nothing
  // else would signal the boot loader to fade — it would stay on screen with
  // the animated squares for the full 20s safety timeout. Signal ready here
  // (idempotent) so a fresh load on a bad URL reveals the page immediately.
  useEffect(() => {
    markAppReady();
  }, []);

  return (
    <div className="flex h-dvh touch-pan-y flex-col overflow-y-auto bg-canvas px-6 py-16 text-center">
      <div className="m-auto flex flex-col items-center gap-5">
      <div className="grid size-16 place-items-center rounded-xl border border-line bg-surface text-ink-3 shadow-2xs">
        <Compass className="size-8" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-ink">{t("notFoundTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          {t("notFoundDescription")}
        </p>
        {location.pathname !== "/" && (
          <p className="mx-auto mt-1 max-w-md truncate font-mono text-xs text-ink-3/70">
            {location.pathname}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        onClick={() => navigate("/timer")}
        className="border-line bg-surface text-ink hover:bg-surface-2"
      >
        {t("notFoundGoHome")}
      </Button>
      </div>
    </div>
  );
}
