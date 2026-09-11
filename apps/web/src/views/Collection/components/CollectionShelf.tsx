"use client";

/**
 * CollectionShelf.tsx — the shelf mode.
 *
 * EXPERIMENTAL (branch `exp/cube-collection`).
 *
 * The counterpart to the rail: instead of depth-of-field drama, a wall of
 * cubbies — one item per cell, evenly lit, no ranking. The only camera motion
 * is a few degrees of parallax following the pointer, which is what makes a
 * flat grid read as a physical object instead of a table of thumbnails.
 *
 * Selected cell wins by contrast (ring + lifted glyph), never by size, so the
 * wall stays a wall.
 */

import { useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { GearGlyph } from "../GearGlyph";
import type { GearItem } from "../collectionModel";

/** How far the wall tilts at the edges of the viewport, in degrees. */
const PARALLAX_Y = 4;
const PARALLAX_X = 5;

interface CollectionShelfProps {
  items: readonly GearItem[];
  focus: number;
  onFocusChange: (index: number) => void;
}

export function CollectionShelf({ items, focus, onFocusChange }: CollectionShelfProps) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useTransform(pointerY, [-1, 1], [PARALLAX_Y, -PARALLAX_Y]);
  const rotateY = useTransform(pointerX, [-1, 1], [-PARALLAX_X, PARALLAX_X]);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Map the pointer to −1…1 across the wall's own box. */
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
      pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
    },
    [pointerX, pointerY],
  );

  const resetParallax = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  return (
    <div className="flex-1 overflow-y-auto px-1 py-6" style={{ perspective: "1400px" }}>
      <motion.div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetParallax}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {items.map((item, index) => {
          const isFocused = index === focus;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFocusChange(index)}
              aria-current={isFocused}
              className={[
                "group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-colors duration-200",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_14px_22px_-18px_rgba(0,0,0,0.55)]",
                isFocused
                  ? "border-line-2 bg-surface ring-1 ring-ink/25"
                  : "border-line/70 bg-surface-2/40 hover:bg-surface/70",
              ].join(" ")}
            >
              {item.primary ? (
                <span className="absolute left-2 top-2 size-1.5 rounded-full bg-ink/70" />
              ) : null}
              <motion.span
                className="flex items-center justify-center"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <GearGlyph item={item} size={104} />
              </motion.span>
              <span className="w-full truncate text-center text-[0.7rem] font-medium text-ink-2">
                {item.name}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
