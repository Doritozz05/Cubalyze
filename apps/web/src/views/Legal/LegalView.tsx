"use client";

/**
 * /privacy, /terms, /storage — standalone legal routes rendered OUTSIDE the
 * app shell (like AuthView/NotFoundView): deep-linkable and indexable.
 *
 * The page owns its scroll container (`h-dvh overflow-y-auto`): the app shell
 * locks `body` scroll (`overflow-hidden` in index.css), so a plain document
 * flow would never scroll. Visual language (brand tile, doc tabs, article
 * card) is shared with `LegalDialog` via LegalArticle.tsx.
 *
 * Content lives in the `legal` i18n namespace (EN+ES). The contact address is
 * the `legal:contactEmail` key so it can be replaced in one place.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";
import { markAppReady } from "@/boot/appReady";
import { DOC_META, LegalArticle, LegalBrandTile, LegalDocTabs } from "./LegalArticle";

export type LegalDoc = "privacy" | "terms" | "storage";

export function LegalView({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation("legal");
  const { t: tMeta } = useTranslation("meta");
  const navigate = useNavigate();

  useDocumentTitle(tMeta(DOC_META[doc].meta));

  // Standalone page outside the shell — nothing else signals the boot loader.
  useEffect(() => {
    markAppReady();
  }, []);

  return (
    <div className="h-dvh touch-pan-y overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <LegalBrandTile />
          <LegalDocTabs active={doc} onSelect={(d) => navigate(`/${d}`)} />
        </header>

        <article className="mt-5 rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <LegalArticle doc={doc} />
        </article>

        <button
          type="button"
          onClick={() => navigate("/timer")}
          className="mx-auto mt-5 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[0.72rem] text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("backToApp")}
        </button>
      </div>
    </div>
  );
}
