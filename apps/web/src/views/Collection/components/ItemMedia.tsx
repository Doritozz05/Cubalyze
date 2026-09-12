"use client";

/**
 * ItemMedia.tsx — the picture slot of a locker item.
 *
 * Three honest states, in priority order:
 *
 *   1. **A photo**, when the item has one. A real picture of *your* cube always
 *      beats any render.
 *   2. **The 3D cube**, for cube categories, drawn by the app's own 3D engine
 *      from the sticker palette (`cubeSnapshotService`). Same model, skins and
 *      camera the 3D panels use, so the locker shows the cube you actually own.
 *   3. **A skeleton**, for everything else (gear, lubes): a quiet surface with
 *      the category icon, so a photo-less card still reads as a product card
 *      instead of a hole in the grid.
 *
 * It takes primitives rather than a `GearItem` on purpose: the item editor
 * previews **unsaved** form state through the very same component, which keeps
 * the editor and the wall pixel-identical.
 *
 * The component fills its container; the caller owns the aspect ratio.
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryIcon } from "../collectionIcons";
import { lockerCubeSnapshotService, type LockerCubeRequest } from "../cubeSnapshotService";

/**
 * Render (or reuse) one cube image. Returns `null` until the offscreen engine
 * has drawn it, which is the cue for the caller to keep its skeleton up.
 */
export function useLockerCubeImage(request: LockerCubeRequest | null): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    request ? lockerCubeSnapshotService.peek(request) : null,
  );

  useEffect(() => {
    if (!request) {
      setUrl(null);
      return;
    }
    const cached = lockerCubeSnapshotService.peek(request);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    lockerCubeSnapshotService.request(request).then((next) => {
      if (alive) setUrl(next || null);
    });
    return () => {
      alive = false;
    };
  }, [request]);

  return url;
}

export interface ItemMediaProps {
  /** First photo, if the item has one. */
  photo?: string;
  /** Sticker colours in U D F B R L order (extras are ignored by the render). */
  palette: readonly string[];
  /** Accessible name of the item. */
  alt: string;
  isCube: boolean;
  /** 2×2 renders 2×2×2; the model derives this from the item's type. */
  order?: number;
  /** Lucide id of the item's category, for the placeholder. */
  categoryIconId?: string;
  /** `card` scales the render down a touch; `hero` shows it at full size. */
  variant?: "card" | "hero";
  className?: string;
}

export function ItemMedia({
  photo,
  palette,
  alt,
  isCube,
  order,
  categoryIconId,
  variant = "card",
  className,
}: ItemMediaProps) {
  const request = useMemo<LockerCubeRequest | null>(
    () => (isCube ? { palette, order } : null),
    [isCube, palette, order],
  );
  const cubeUrl = useLockerCubeImage(request);

  if (photo) {
    return (
      <img
        src={photo}
        alt={alt}
        draggable={false}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  if (isCube) {
    return cubeUrl ? (
      <img
        src={cubeUrl}
        alt={alt}
        draggable={false}
        className={cn(
          "h-full w-full object-contain",
          variant === "card" ? "scale-[0.96]" : "scale-[0.92]",
          className,
        )}
      />
    ) : (
      <CubeSkeleton className={className} />
    );
  }

  const Icon = categoryIcon(categoryIconId);
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-full w-full items-center justify-center",
        "bg-[linear-gradient(140deg,var(--surface-2),transparent)]",
        className,
      )}
    >
      <Icon className="size-6 animate-pulse text-ink-3/50" />
    </div>
  );
}

/** Neutral shimmer shown while the offscreen engine has not answered yet. */
function CubeSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-full w-full items-center justify-center", className)}>
      <div
        className="size-[62%] animate-pulse bg-[linear-gradient(140deg,var(--surface-2),transparent)]"
        style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
      />
    </div>
  );
}
