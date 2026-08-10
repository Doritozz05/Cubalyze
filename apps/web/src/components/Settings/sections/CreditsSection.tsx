"use client";

import type { LucideIcon } from "lucide-react";
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
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditItem {
  name: string;
  detail?: string;
  link?: string;
}

interface CreditCategory {
  title: string;
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
    title: "Algorithm database",
    icon: Database,
    tone: "emerald",
    items: [
      {
        name: "SpeedCubeDB",
        detail:
          "Core algorithm database (PLL, OLL, F2L, COLL, WV, CLS, ELL, SV, Anti-PLL) with community votes and per-algorithm verification.",
        link: "https://speedcubedb.com",
      },
      {
        name: "BirdF2L",
        detail:
          "F2L algorithm dataset (LGPL-3.0) and the advanced F2L case taxonomy used across the app.",
        link: "https://github.com/andydude/birdf2l",
      },
    ],
  },
  {
    title: "Speedcubing reconstructions",
    icon: ScanSearch,
    tone: "sky",
    items: [
      {
        name: "CubeRoot",
        detail:
          "Official and unofficial reconstructions, with a link back to every original solve.",
        link: "https://cuberoot.me",
      },
      {
        name: "reco.nz (reconz)",
        detail:
          "Community reconstructions compiled by the speedcubing community (Brest and many reconstructors), credited per solve.",
        link: "https://reco.nz",
      },
      {
        name: "World Cube Association",
        detail:
          "Competition metadata and results referenced in reconstruction records.",
        link: "https://www.worldcubeassociation.org",
      },
    ],
  },
  {
    title: "Solvers & algorithms",
    icon: Cpu,
    tone: "violet",
    items: [
      {
        name: "Kociemba's Two-Phase Algorithm",
        detail: "The two-phase solver that powers the solve-analysis engine.",
      },
      {
        name: "min2phase.js",
        detail:
          "JavaScript port of Kociemba's algorithm (MIT / GPL-3.0).",
        link: "https://github.com/cs0x7f/min2phase",
      },
    ],
  },
  {
    title: "3D & rendering",
    icon: Layers,
    tone: "cyan",
    items: [
      {
        name: "three.js",
        detail: "3D cube rendering engine (MIT).",
        link: "https://threejs.org",
      },
      {
        name: "three-stdlib",
        detail: "Helper utilities for three.js.",
      },
    ],
  },
  {
    title: "Hardware & connectivity",
    icon: Bluetooth,
    tone: "blue",
    items: [
      {
        name: "GAN Cube smart cubes",
        detail:
          "GAN 356i and Gen2/Gen3 series — the hardware supported through our Bluetooth integration.",
        link: "https://www.gancube.com",
      },
      {
        name: "gan-web-bluetooth",
        detail:
          "Community reverse-engineering of the GAN BLE protocol (by afedotov), which our protocol implementation is based on.",
        link: "https://github.com/afedotov/gan-web-bluetooth",
      },
      {
        name: "Web Bluetooth API",
        detail: "Browser connectivity for smart-cube communication.",
      },
    ],
  },
  {
    title: "Community & inspiration",
    icon: Users,
    tone: "rose",
    items: [
      {
        name: "Speedsolving.com",
        detail:
          "The speedcubing community and its collective algorithm knowledge.",
        link: "https://www.speedsolving.com",
      },
      {
        name: "CubeSkills",
        detail: "CFOP solve-split reference benchmarks.",
        link: "https://www.cubeskills.com",
      },
      {
        name: "Every reconstructor & algorithm author",
        detail:
          "Individual contributions are credited per solve and per algorithm throughout the app.",
      },
    ],
  },
];

/** Tech-stack chips ("built with") — the engine room behind the app. */
const BUILT_WITH: { name: string; detail: string }[] = [
  {
    name: "React · React DOM · Vite · TypeScript",
    detail: "Application framework and tooling.",
  },
  {
    name: "Tailwind CSS · Radix UI · CVA · clsx · tailwind-merge",
    detail: "Design system and UI primitives.",
  },
  {
    name: "Zustand · RxJS · React Router · TanStack Virtual · Comlink",
    detail: "State, reactive streams, navigation, virtualization, workers.",
  },
  {
    name: "Framer Motion · Recharts · Lucide icons · canvas-confetti",
    detail: "Animation, charts and iconography.",
  },
  {
    name: "date-fns · country-flag-icons · embla-carousel-react · react-day-picker",
    detail: "Dates, flags, carousels and calendars.",
  },
  {
    name: "react-hook-form · vaul · sonner · input-otp · uuid · use-debounce",
    detail: "Forms, drawers, toasts and utilities.",
  },
  {
    name: "next-themes · react-resizable-panels",
    detail: "Theming and resizable layouts.",
  },
  {
    name: "SQLite (public domain) · SheetJS",
    detail: "Local database engine (Apache-2.0 wrapper) and spreadsheet import/export (Apache-2.0).",
  },
];

export function CreditsSection() {
  const linkedCount = CATEGORIES.reduce(
    (acc, cat) => acc + cat.items.filter((i) => i.link).length,
    0,
  );
  const totalCount = CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Intro ─────────────────────────────────────────────────────── */}
      <div className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent-emerald/25 bg-accent-emerald/10">
          <Heart className="size-4 text-accent-emerald" fill="currentColor" />
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.85rem] font-semibold leading-5 text-ink">
            Made possible by the community
          </h4>
          <p className="mt-1 text-[0.75rem] leading-5 text-ink-3">
            CubeForge is built on the work of the speedcubing community and a
            wide range of open-source projects — {linkedCount} sources with
            links, {totalCount} credits in total. We are grateful to everyone
            who shares algorithms, reconstructions and knowledge.
          </p>
        </div>
      </div>

      {/* ── Built with (tech stack chips) ────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-4 transition-shadow duration-200 hover:shadow-sm">
        <header className="mb-3 flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
            <Package className="size-3.5" />
          </span>
          <h4 className="text-[0.8rem] font-semibold leading-5 text-ink">
            Built with
          </h4>
          <span className="ml-auto hidden rounded-md border border-line bg-surface-2/40 px-2 py-0.5 text-[0.62rem] font-medium text-ink-3 sm:inline-block">
            {BUILT_WITH.length} library groups
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
                {chip.detail}
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
              key={category.title}
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
                  {category.title}
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
                        className="group/link inline-flex items-center gap-1 text-[0.78rem] font-medium text-ink underline-offset-2 transition-colors duration-150 hover:text-accent-emerald"
                      >
                        {item.name}
                        <ArrowUpRight className="size-3 shrink-0 text-ink-3 transition-transform duration-150 group-hover/link:-translate-y-px group-hover/link:translate-x-px group-hover/link:text-accent-emerald" />
                      </a>
                    ) : (
                      <span className="text-[0.78rem] font-medium text-ink">
                        {item.name}
                      </span>
                    )}
                    {item.detail && (
                      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-ink-3">
                        {item.detail}
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
          Full data provenance and regeneration notes are documented in{" "}
          <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[0.62rem] text-ink-2">
            DATA_SOURCES.md
          </code>{" "}
          at the repository root. CubeForge itself is released under the MIT
          license.
        </p>
      </div>
    </div>
  );
}
