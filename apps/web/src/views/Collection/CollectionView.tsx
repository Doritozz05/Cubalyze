"use client";

/**
 * CollectionView.tsx — the Locker (gear collection).
 *
 * EXPERIMENTAL (branch `exp/cube-collection`).
 *
 * Two ways to look at the same list, because they answer different questions:
 *
 *   - **Rail**  (default) — "what is this thing?" One item at centre stage,
 *     depth behind it. Uses the existing glyph as a product render.
 *   - **Shelf** — "what do I own?" The whole set at once, no ranking.
 *
 * The spec sheet below is shared by both, so switching modes never changes
 * what the page is telling you. There is no persistence yet by design: items
 * come from `loadCollection()`, whose only implementation today is the sample
 * catalog behind the `CollectionSource` seam.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { GalleryHorizontal, LayoutGrid, Package } from "lucide-react";
import { CollectionRail } from "./components/CollectionRail";
import { CollectionShelf } from "./components/CollectionShelf";
import { GearSpecSheet } from "./components/GearSpecSheet";
import {
  countByKind,
  loadCollection,
  sortGear,
  type GearItem,
} from "./collectionModel";

type ViewMode = "rail" | "shelf";

const MODES: ReadonlyArray<{ id: ViewMode; icon: typeof LayoutGrid; labelKey: "modes.rail" | "modes.shelf" }> = [
  { id: "rail", icon: GalleryHorizontal, labelKey: "modes.rail" },
  { id: "shelf", icon: LayoutGrid, labelKey: "modes.shelf" },
];

export function CollectionView() {
  const { t } = useTranslation("collection");
  const [items, setItems] = useState<readonly GearItem[] | null>(null);
  const [focus, setFocus] = useState(0);
  const [mode, setMode] = useState<ViewMode>("rail");
  const rootRef = useRef<HTMLDivElement>(null);

  // Single read through the source seam — swap the implementation for a
  // persisted collection and nothing else in this file changes.
  useEffect(() => {
    let cancelled = false;
    void loadCollection().then((loaded) => {
      if (!cancelled) setItems(sortGear(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => (items ? countByKind(items) : null), [items]);
  const focused = items && items.length > 0 ? items[Math.min(focus, items.length - 1)] : undefined;

  // ← / → scrub the rail, but only while the rail is on screen and the keyboard
  // belongs to this view — the timer owns global shortcuts elsewhere.
  useEffect(() => {
    if (mode !== "rail" || !items || items.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const active = document.activeElement;
      const insideView = active === document.body || rootRef.current?.contains(active);
      if (!insideView) return;
      event.preventDefault();
      setFocus((current) => {
        const next = event.key === "ArrowLeft" ? current - 1 : current + 1;
        return Math.min(items.length - 1, Math.max(0, next));
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, items]);

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-canvas">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-7">
        <div>
          <div className="flex items-center gap-2 text-ink-3">
            <Package className="size-3.5" />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]">
              {t("eyebrow")}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
          <p className="mt-1 max-w-prose text-[0.82rem] text-ink-3">{t("subtitle")}</p>
          {counts ? (
            <p className="mt-2 text-[0.72rem] text-ink-3">
              {t("summary", {
                total: items?.length ?? 0,
                cubes: counts.cube,
              })}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[0.7rem] text-ink-3 sm:inline">{t("sampleNotice")}</span>
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2/60 p-1">
            {MODES.map((entry) => {
              const Icon = entry.icon;
              const isActive = mode === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMode(entry.id)}
                  aria-pressed={isActive}
                  className={[
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-medium transition-colors",
                    isActive ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
                  ].join(" ")}
                >
                  <Icon className="size-3.5" />
                  {t(entry.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Stage ────────────────────────────────────────────────────── */}
      <main className="relative flex min-h-[380px] flex-1 px-4">
        {items === null ? (
          <div className="flex flex-1 items-center justify-center text-[0.78rem] text-ink-3">
            {t("loading")}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : mode === "rail" ? (
          <CollectionRail items={items} focus={focus} onFocusChange={setFocus} />
        ) : (
          <CollectionShelf items={items} focus={focus} onFocusChange={setFocus} />
        )}
      </main>

      {/* ── Spec sheet ───────────────────────────────────────────────── */}
      {focused ? (
        <footer className="max-h-[44vh] shrink-0 overflow-y-auto border-t border-line bg-surface/60 px-6 py-6 backdrop-blur-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={focused.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              <GearSpecSheet item={focused} />
            </motion.div>
          </AnimatePresence>
        </footer>
      ) : null}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation("collection");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Package className="size-5 text-ink-3" />
      <p className="text-sm font-medium text-ink-2">{t("empty")}</p>
      <p className="max-w-xs text-[0.75rem] text-ink-3">{t("emptyHint")}</p>
    </div>
  );
}
