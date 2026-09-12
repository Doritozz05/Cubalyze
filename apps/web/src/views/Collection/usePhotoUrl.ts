"use client";

/**
 * usePhotoUrl — resolve a Locker photo reference into a displayable URL.
 *
 * The blobs live in IndexedDB, so every mount is an async read plus an object
 * URL that MUST be released when the component goes away; this hook owns that
 * lifecycle so no component has to think about it.
 */

import { useEffect, useState } from "react";
import { acquirePhotoUrl } from "./collectionPhotos";

export function usePhotoUrl(
  itemId: string | null | undefined,
  photoId: string | null | undefined,
  size: "thumb" | "full" = "thumb",
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId || !photoId) {
      setUrl(null);
      return;
    }
    let alive = true;
    let release: (() => void) | null = null;

    acquirePhotoUrl(itemId, photoId, size).then((result) => {
      if (alive) {
        release = result.release;
        setUrl(result.url);
      } else {
        // Unmounted while the blob was being read: hand the reference back.
        result.release();
      }
    });

    return () => {
      alive = false;
      setUrl(null);
      if (release) {
        release();
        release = null;
      }
    };
  }, [itemId, photoId, size]);

  return url;
}
