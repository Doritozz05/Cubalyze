"use client";

import { useEffect, useState } from "react";
import type { AlgorithmCase } from "@cubalyze/algorithm-db";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";

/** Tiny 3D snapshot of an F2L case (shared offscreen WebGL engine + cache). */
export function CaseMiniCube({
  caseData,
  slotIndex,
  stickerColors,
  alt,
}: {
  caseData: AlgorithmCase;
  slotIndex: number;
  stickerColors?: Record<string, string> | null;
  alt: string;
}) {
  const service = Global3DSnapshotService.getInstance();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    service
      .requestSnapshot(caseData, {
        selectedSlot: slotIndex,
        stickerColors: stickerColors ?? undefined,
      })
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        // WebGL unavailable fallback
      });
    return () => {
      alive = false;
    };
  }, [service, caseData, slotIndex, stickerColors]);

  if (!url) {
    return (
      <span
        className="block size-8 sm:size-10 shrink-0 animate-pulse rounded-md border border-line bg-surface-2/40"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className="pointer-events-none size-8 sm:size-10 shrink-0 rounded-md border border-line bg-surface-2/40 object-contain"
    />
  );
}
