"use client";

/**
 * Shared legal-article building blocks.
 *
 * `LegalArticle` renders one document (privacy / terms / storage) from the
 * `legal` i18n namespace. It is used in two shells that share the same visual
 * language:
 *   · `LegalView` — the standalone /privacy, /terms, /storage routes
 *     (deep-linkable, SEO); the page owns its scroll container because the
 *     app shell locks `body` scroll (`overflow-hidden` in index.css).
 *   · `LegalDialog` — Dialog on desktop / Drawer on touch, opened from
 *     Settings → Credits and the sign-in card without leaving the screen.
 *
 * Brand tile copies the sidebar logo exactly (ink tile + Grid3x3 mark +
 * literal "Cubalyze" wordmark — never translated, guarded by
 * tests/contracts/brandSurface.test.ts).
 */

import { useTranslation } from "react-i18next";
import { Grid3x3 } from "lucide-react";
import type { LegalDoc } from "./LegalView";

export const DOC_ORDER: LegalDoc[] = ["privacy", "terms", "storage"];

export function LegalBrandTile({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid shrink-0 place-items-center rounded-md bg-ink text-surface ${
          compact ? "size-8" : "size-9"
        }`}
      >
        <Grid3x3 className={compact ? "size-4" : "size-[1.1rem]"} aria-hidden="true" />
      </div>
      <span className="nums whitespace-nowrap text-sm font-semibold tracking-tight text-ink">
        Cubalyze
      </span>
    </div>
  );
}

export function LegalDocTabs({
  active,
  onSelect,
}: {
  active: LegalDoc;
  onSelect: (doc: LegalDoc) => void;
}) {
  const { t } = useTranslation("legal");
  return (
    <div
      role="tablist"
      aria-label={t("navPrivacy")}
      className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface-2/50 p-1"
    >
      {DOC_ORDER.map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={d === active}
          type="button"
          onClick={() => onSelect(d)}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-[0.72rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
            d === active
              ? "bg-ink text-surface shadow-xs"
              : "text-ink-3 hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {d === "privacy" ? t("navPrivacy") : d === "terms" ? t("navTerms") : t("navStorage")}
        </button>
      ))}
    </div>
  );
}

export function LegalArticle({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation("legal");
  const contactEmail = t("contactEmail");
  const meta = DOC_META[doc];
  return (
    <>
      <h2 className="text-lg font-semibold leading-tight text-ink">{t(meta.title)}</h2>
      <p className="mt-1 text-[0.7rem] text-ink-3">{t(meta.updated)}</p>
      <p className="mt-3 rounded-lg border border-line/60 bg-surface-2/50 px-3.5 py-3 text-[0.8rem] leading-relaxed text-ink-2">
        {t(meta.intro, { contactEmail })}
      </p>
      {DOC_SECTIONS[doc].map(([titleKey, bodyKey]) => (
        <section key={titleKey} className="mt-5">
          <h3 className="text-[0.88rem] font-semibold text-ink">
            {t(titleKey, { contactEmail })}
          </h3>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-2">
            {t(bodyKey, { contactEmail })}
          </p>
        </section>
      ))}
    </>
  );
}

// Literal key tables (typed i18n rejects computed template keys).
export const DOC_META = {
  privacy: { title: "privacy.title", updated: "privacy.updated", intro: "privacy.intro", meta: "privacy" },
  terms: { title: "terms.title", updated: "terms.updated", intro: "terms.intro", meta: "terms" },
  storage: { title: "storage.title", updated: "storage.updated", intro: "storage.intro", meta: "storage" },
} as const;

export const DOC_SECTIONS = {
  privacy: [
    ["privacy.p1t", "privacy.p1b"],
    ["privacy.p2t", "privacy.p2b"],
    ["privacy.p3t", "privacy.p3b"],
    ["privacy.p4t", "privacy.p4b"],
    ["privacy.p5t", "privacy.p5b"],
    ["privacy.p6t", "privacy.p6b"],
    ["privacy.p7t", "privacy.p7b"],
    ["privacy.p8t", "privacy.p8b"],
    ["privacy.p9t", "privacy.p9b"],
    ["privacy.p10t", "privacy.p10b"],
    ["privacy.p11t", "privacy.p11b"],
  ],
  terms: [
    ["terms.t1t", "terms.t1b"],
    ["terms.t2t", "terms.t2b"],
    ["terms.t3t", "terms.t3b"],
    ["terms.t4t", "terms.t4b"],
    ["terms.t5t", "terms.t5b"],
    ["terms.t6t", "terms.t6b"],
    ["terms.t7t", "terms.t7b"],
    ["terms.t9t", "terms.t9b"],
    ["terms.t8t", "terms.t8b"],
  ],
  storage: [
    ["storage.s1t", "storage.s1b"],
    ["storage.s2t", "storage.s2b"],
    ["storage.s3t", "storage.s3b"],
    ["storage.s4t", "storage.s4b"],
    ["storage.s5t", "storage.s5b"],
    ["storage.s6t", "storage.s6b"],
  ],
} as const;
