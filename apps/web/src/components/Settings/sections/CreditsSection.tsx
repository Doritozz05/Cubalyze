"use client";

import { Heart } from "lucide-react";

interface CreditsSectionData {
  title: string;
  items: { name: string; detail?: string; link?: string }[];
}

const SECTIONS: CreditsSectionData[] = [
  {
    title: "Algorithm database",
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
    items: [
      {
        name: "Kociemba's Two-Phase Algorithm",
        detail:
          "The two-phase solver that powers the solve-analysis engine.",
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
    title: "Frameworks & libraries",
    items: [
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
    ],
  },
  {
    title: "Community & inspiration",
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

export function CreditsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <Heart className="mt-0.5 size-3.5 shrink-0 text-caution" />
        <span className="text-[0.78rem] leading-5 text-ink-3">
          CubeForge is built on the work of the speedcubing community and a wide
          range of open-source projects. We are grateful to everyone who shares
          algorithms, reconstructions and knowledge.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-line bg-surface-2 p-3"
          >
            <h4 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
              {section.title}
            </h4>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.name} className="text-xs leading-relaxed">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-ink transition-colors hover:text-caution"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className="font-semibold text-ink">{item.name}</span>
                  )}
                  {item.detail && (
                    <span className="mt-0.5 block text-ink-3">{item.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink-3">
        Full data provenance and regeneration notes are documented in{" "}
        <code className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono">
          DATA_SOURCES.md
        </code>{" "}
        in the repository root. CubeForge itself is released under the MIT
        license.
      </p>
    </div>
  );
}
