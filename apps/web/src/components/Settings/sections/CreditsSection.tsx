"use client";

import type { LucideIcon } from "lucide-react";
import type { ParseKeys } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LegalDialog } from "@/views/Legal/LegalDialog";
import type { LegalDoc } from "@/views/Legal/LegalView";
import {
  ArrowUpRight,
  Bluetooth,
  Cpu,
  Database,
  FileText,
  Heart,
  Layers,
  Package,
  ScanSearch,
  Scale,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import changelogData from "@/data/changelog/changelog.json";

interface CreditItem {
  name: string;
  detailKey?: ParseKeys<"settings">;
  link?: string;
}

interface CreditCategory {
  titleKey: ParseKeys<"settings">;
  icon: LucideIcon;
  /** Phase-palette tone used for the category's icon chip. */
  tone: keyof typeof TONES;
  items: CreditItem[];
}

const TONES = {
  emerald: "bg-phase-emerald/10 text-phase-emerald",
  sky: "bg-phase-sky/10 text-phase-sky",
  violet: "bg-phase-violet/10 text-phase-violet",
  cyan: "bg-phase-cyan/10 text-phase-cyan",
  blue: "bg-phase-blue/10 text-phase-blue",
  rose: "bg-phase-rose/10 text-phase-rose",
} as const;

const CATEGORIES: CreditCategory[] = [
  {
    titleKey: "credits.categories.algorithmDb.title",
    icon: Database,
    tone: "emerald",
    items: [
      {
        name: "SpeedCubeDB",
        detailKey: "credits.categories.algorithmDb.i1",
        link: "https://speedcubedb.com",
      },
      {
        name: "BirdF2L",
        detailKey: "credits.categories.algorithmDb.i2",
        link: "https://github.com/andydude/birdf2l",
      },
    ],
  },
  {
    titleKey: "credits.categories.reconstructions.title",
    icon: ScanSearch,
    tone: "sky",
    items: [
      {
        name: "CubeRoot",
        detailKey: "credits.categories.reconstructions.i1",
        link: "https://cuberoot.me",
      },
      {
        name: "reco.nz (reconz)",
        detailKey: "credits.categories.reconstructions.i2",
        link: "https://reco.nz",
      },
      {
        name: "World Cube Association",
        detailKey: "credits.categories.reconstructions.i3",
        link: "https://www.worldcubeassociation.org",
      },
    ],
  },
  {
    titleKey: "credits.categories.solvers.title",
    icon: Cpu,
    tone: "violet",
    items: [
      {
        name: "Kociemba's Two-Phase Algorithm",
        detailKey: "credits.categories.solvers.i1",
      },
      {
        name: "min2phase.js",
        detailKey: "credits.categories.solvers.i2",
        link: "https://github.com/cs0x7f/min2phase",
      },
    ],
  },
  {
    titleKey: "credits.categories.rendering.title",
    icon: Layers,
    tone: "cyan",
    items: [
      {
        name: "three.js",
        detailKey: "credits.categories.rendering.i1",
        link: "https://threejs.org",
      },
      {
        name: "three-stdlib",
        detailKey: "credits.categories.rendering.i2",
      },
    ],
  },
  {
    titleKey: "credits.categories.hardware.title",
    icon: Bluetooth,
    tone: "blue",
    items: [
      {
        name: "GAN Cube smart cubes",
        detailKey: "credits.categories.hardware.i1",
        link: "https://www.gancube.com",
      },
      {
        name: "gan-web-bluetooth",
        detailKey: "credits.categories.hardware.i2",
        link: "https://github.com/afedotov/gan-web-bluetooth",
      },
      {
        name: "Web Bluetooth API",
        detailKey: "credits.categories.hardware.i3",
      },
    ],
  },
  {
    titleKey: "credits.categories.community.title",
    icon: Users,
    tone: "rose",
    items: [
      {
        name: "Speedsolving.com",
        detailKey: "credits.categories.community.i1",
        link: "https://www.speedsolving.com",
      },
      {
        name: "CubeSkills",
        detailKey: "credits.categories.community.i2",
        link: "https://www.cubeskills.com",
      },
      {
        name: "Every reconstructor & algorithm author",
        detailKey: "credits.categories.community.i3",
      },
    ],
  },
];

/** Tech-stack chips ("built with") — the engine room behind the app. */
const BUILT_WITH: { name: string; detailKey: ParseKeys<"settings"> }[] = [
  {
    name: "React · React DOM · Vite · TypeScript",
    detailKey: "credits.builtWithDetails.d1",
  },
  {
    name: "Tailwind CSS · Radix UI · CVA · clsx · tailwind-merge",
    detailKey: "credits.builtWithDetails.d2",
  },
  {
    name: "Zustand · RxJS · React Router · TanStack Virtual · Comlink",
    detailKey: "credits.builtWithDetails.d3",
  },
  {
    name: "Framer Motion · Recharts · Lucide icons · canvas-confetti",
    detailKey: "credits.builtWithDetails.d4",
  },
  {
    name: "date-fns · country-flag-icons · embla-carousel-react · react-day-picker",
    detailKey: "credits.builtWithDetails.d5",
  },
  {
    name: "react-hook-form · vaul · sonner · input-otp · uuid · use-debounce",
    detailKey: "credits.builtWithDetails.d6",
  },
  {
    name: "next-themes · react-resizable-panels",
    detailKey: "credits.builtWithDetails.d7",
  },
  {
    name: "SQLite (public domain) · SheetJS",
    detailKey: "credits.builtWithDetails.d8",
  },
];

export function CreditsSection() {
  const { t } = useTranslation("settings");
  const { t: tLegal } = useTranslation("legal");
  // Legal docs open in-dialog (no navigation away from Settings); the
  // /privacy, /terms, /storage routes stay for deep links and search.
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  const linkedCount = CATEGORIES.reduce(
    (acc, cat) => acc + cat.items.filter((i) => i.link).length,
    0,
  );
  const totalCount = CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Intro ─────────────────────────────────────────────────────── */}
      <div className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#047857]/25 bg-[#047857]/10 dark:border-[#34d399]/25 dark:bg-[#34d399]/10">
          <Heart className="size-4 text-[#047857] dark:text-[#34d399]" fill="currentColor" />
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.85rem] font-semibold leading-5 text-ink">
            {t("credits.introTitle")}
          </h4>
          <p className="mt-1 text-[0.75rem] leading-5 text-ink-3">
            {t("credits.introBody", { linked: linkedCount, total: totalCount })}
          </p>
        </div>
      </div>

      {/* ── App version ──────────────────────────────────────────────── */}
      <section className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition-shadow duration-200 hover:shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
            <Tag className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h4 className="text-[0.8rem] font-semibold leading-5 text-ink">
              {t("credits.version")}
            </h4>
            <p className="text-[0.7rem] leading-snug text-ink-3">
              {t("credits.versionHint")}
            </p>
          </div>
        </div>
        <code className="shrink-0 whitespace-nowrap rounded-md border border-line bg-surface-2/60 px-2.5 py-1 font-mono text-[0.72rem] font-medium text-ink-2">
          v{changelogData.currentVersion || changelogData.versions?.[changelogData.versions.length - 1]?.version || __APP_VERSION__} · {__BUILD_SHA__}
        </code>
      </section>

      {/* ── Built with (tech stack chips) ────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-4 transition-shadow duration-200 hover:shadow-sm">
        <header className="mb-3 flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
            <Package className="size-3.5" />
          </span>
          <h4 className="text-[0.8rem] font-semibold leading-5 text-ink">
            {t("credits.builtWithTitle")}
          </h4>
          <span className="ml-auto hidden rounded-md border border-line bg-surface-2/40 px-2 py-0.5 text-[0.62rem] font-medium text-ink-3 sm:inline-block">
            {t("credits.libraryGroups", { count: BUILT_WITH.length })}
          </span>
        </header>
        <div className="flex flex-wrap gap-2">
          {BUILT_WITH.map((chip) => (
            <span
              key={chip.name}
              className="inline-flex flex-col gap-0.5 rounded-lg border border-line bg-surface-2/40 px-3 py-1.5 transition-colors duration-150 hover:border-line-2 hover:bg-surface-2"
            >
              <span className="text-[0.7rem] font-medium leading-tight text-ink-2">
                {chip.name}
              </span>
              <span className="text-[0.62rem] leading-snug text-ink-3">
                {t(chip.detailKey)}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Categorized credits ──────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <section
              key={category.titleKey}
              className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-shadow duration-200 hover:shadow-sm"
            >
              <header className="mb-3 flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    TONES[category.tone],
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <h4 className="text-[0.8rem] font-semibold leading-5 text-ink">
                  {t(category.titleKey)}
                </h4>
              </header>
              <ul className="flex flex-col gap-3">
                {category.items.map((item) => (
                  <li key={item.name}>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="group/link inline-flex items-center gap-1 text-[0.78rem] font-medium text-ink underline-offset-2 transition-colors duration-150 hover:text-[#047857] dark:hover:text-[#34d399]"
                      >
                        {item.name}
                        <ArrowUpRight className="size-3 shrink-0 text-ink-3 transition-transform duration-150 group-hover/link:-translate-y-px group-hover/link:translate-x-px group-hover/link:text-[#047857] dark:group-hover/link:text-[#34d399]" />
                      </a>
                    ) : (
                      <span className="text-[0.78rem] font-medium text-ink">
                        {item.name}
                      </span>
                    )}
                    {item.detailKey && (
                      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-ink-3">
                        {t(item.detailKey)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ── License & provenance footer ──────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <p className="text-[0.65rem] leading-relaxed text-ink-3">
          {t("credits.provenance", { file: "DATA_SOURCES.md" })}
        </p>
      </div>

      {/* ── Legal (privacy, terms, storage) ────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-4 transition-shadow duration-200 hover:shadow-sm">
        <header className="mb-1 flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
            <Scale className="size-3.5" />
          </span>
          <h4 className="text-[0.8rem] font-semibold leading-5 text-ink">
            {t("credits.legalTitle")}
          </h4>
        </header>
        <p className="mb-3 text-[0.7rem] leading-relaxed text-ink-3">
          {t("credits.legalBody")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { doc: "privacy", label: tLegal("navPrivacy") },
              { doc: "terms", label: tLegal("navTerms") },
              { doc: "storage", label: tLegal("navStorage") },
            ] as const
          ).map((link) => (
            <button
              key={link.doc}
              type="button"
              onClick={() => setLegalDoc(link.doc)}
              className="cursor-pointer rounded-lg border border-line bg-surface-2/40 px-3 py-1.5 text-[0.7rem] font-medium text-ink-2 transition-colors duration-150 hover:border-line-2 hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </button>
          ))}
        </div>
      </section>
      {legalDoc && (
        <LegalDialog
          doc={legalDoc}
          open={legalDoc !== null}
          onOpenChange={(open) => {
            if (!open) setLegalDoc(null);
          }}
        />
      )}

      {/* ── Maintainer (operator identity — last block, never the front page) */}
      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <Users className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <p className="text-[0.65rem] leading-relaxed text-ink-3">
          {t("credits.operatorTitle")}: {t("credits.operatorBody")}{" "}
          {tLegal("contactEmail")}
        </p>
      </div>
    </div>
  );
}
