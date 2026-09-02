"use client";

import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import changelogData from "@/data/changelog/changelog.json";

interface ChangelogItem {
  type: "new" | "improved" | "fixed" | "breaking";
  en: string;
  es: string;
}

interface ChangelogVersion {
  version: string;
  isCurrent: boolean;
  name: { en: string; es: string };
  period: { en: string; es: string };
  date?: string;
  endDate?: string;
  items: ChangelogItem[];
  moral?: { en: string; es: string };
}

interface ChangelogData {
  currentVersion: string;
  versions: ChangelogVersion[];
}

const data = changelogData as unknown as ChangelogData;

const CHANGE_BADGE_STYLES: Record<ChangelogItem["type"], string> = {
  new: "bg-ink text-surface font-semibold",
  improved: "bg-phase-sky/15 text-phase-sky font-medium",
  fixed: "bg-phase-emerald/15 text-phase-emerald font-medium",
  breaking: "bg-dnf/15 text-dnf font-medium",
};

const CHANGE_KEYS: Record<ChangelogItem["type"], ParseKeys<"settings">> = {
  new: "changelog.changeNew",
  improved: "changelog.changeImproved",
  fixed: "changelog.changeFixed",
  breaking: "changelog.changeBreaking",
};

function formatReleaseDate(
  dateStr?: string,
  periodFallback?: string,
  lang: "en" | "es" = "en",
): string {
  if (!dateStr) return periodFallback ?? "";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (lang === "es") {
        return date.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    // fallback below
  }
  return periodFallback ?? "";
}

export function ChangelogSection() {
  const { t, i18n } = useTranslation("settings");
  const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";

  // Display newest versions first
  const versions = [...data.versions].reverse();
  const defaultOpenVersions = [data.currentVersion || versions[0]?.version].filter(Boolean);

  return (
    <div className="w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-sm font-semibold text-ink">
          {t("sections.changelog.label", { defaultValue: "Changelog" })}
        </h3>
        <span className="text-xs text-ink-3">
          {versions.length} {lang === "es" ? "lanzamientos" : "releases"}
        </span>
      </div>

      {/* Accordion List */}
      <Accordion type="multiple" defaultValue={defaultOpenVersions}>
        {versions.map((v) => {
          const isCurrent = v.version === data.currentVersion || v.isCurrent;
          const hasBreaking = v.items.some((item) => item.type === "breaking");
          const exactDate = formatReleaseDate(v.date ?? v.endDate, v.period[lang], lang);

          return (
            <AccordionItem
              key={v.version}
              value={v.version}
              className="border-b border-line/60 last:border-b-0"
            >
              <AccordionTrigger className="py-3.5 hover:no-underline [&>svg]:text-ink-3 [&>svg]:size-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-ink">
                    v{v.version}
                  </span>

                  {isCurrent && (
                    <span className="inline-flex h-5 items-center justify-center rounded-full bg-phase-emerald/15 px-2 text-[10px] font-semibold uppercase tracking-wider leading-none text-phase-emerald">
                      {t("changelog.latest", { defaultValue: "Latest" })}
                    </span>
                  )}

                  {hasBreaking && !isCurrent && (
                    <span className="inline-flex h-5 items-center justify-center rounded-full bg-dnf/15 px-2 text-[10px] font-semibold uppercase tracking-wider leading-none text-dnf">
                      {t("changelog.changeBreaking", { defaultValue: "Breaking" })}
                    </span>
                  )}

                  <span className="text-xs text-ink-3 font-normal">
                    {exactDate}
                  </span>
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4 pt-1">
                <ul className="flex flex-col gap-2.5">
                  {v.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "inline-flex h-5 shrink-0 items-center justify-center rounded px-2 text-[10px] font-semibold leading-none tracking-wide",
                          CHANGE_BADGE_STYLES[item.type],
                        )}
                      >
                        {t(CHANGE_KEYS[item.type])}
                      </span>
                      <span className="text-xs leading-5 text-ink-2">
                        {item[lang]}
                      </span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}