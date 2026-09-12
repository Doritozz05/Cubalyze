"use client";

/**
 * PhotoImage.tsx — one stored photo, rendered.
 *
 * A locker photo is a blob in IndexedDB addressed by a reference, so displaying
 * it is an async read plus an object URL that has to be handed back. `usePhotoUrl`
 * owns that lifecycle; this component owns the layout so no caller has to think
 * about the third state — "there IS a photo, its bytes are still coming".
 *
 * That state keeps a quiet shimmer in place instead of collapsing the box, which
 * is what stops a wall of cards from reflowing as the thumbnails arrive.
 */

import { cn } from "@/lib/utils";
import { usePhotoUrl } from "../usePhotoUrl";
import type { GearPhotoRef } from "../collectionModel";

export interface PhotoImageProps {
  /** Owner of the photo — the item id it was stored under. */
  itemId: string;
  photo: GearPhotoRef;
  /** `thumb` for grids and galleries, `full` for the product page. */
  size?: "thumb" | "full";
  alt?: string;
  className?: string;
}

export function PhotoImage({ itemId, photo, size = "thumb", alt = "", className }: PhotoImageProps) {
  const url = usePhotoUrl(itemId, photo.id, size);

  if (!url) {
    return (
      <div
        aria-hidden
        className={cn("animate-pulse bg-[linear-gradient(140deg,var(--surface-2),transparent)]", className)}
      />
    );
  }

  return <img src={url} alt={alt} draggable={false} className={className} />;
}
