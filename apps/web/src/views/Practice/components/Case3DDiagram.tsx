"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import { getSkinStyle } from "@cubeforge/cube-3d-engine";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";

const F2L_SUBSET_IDS = new Set([
  "00000000-0000-4000-9000-000000000003", // Basic F2L
  "00000000-0000-4000-9000-000000000004", // Advanced F2L
]);

const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right", modelYRot: 0 },
  { id: 1, key: "FL", name: "Front Left", modelYRot: Math.PI / 2 },
  { id: 2, key: "BL", name: "Back Left", modelYRot: Math.PI },
  { id: 3, key: "BR", name: "Back Right", modelYRot: -Math.PI / 2 },
];

const F2L_GRAY = "#808080";

function buildF2LSkinStyle() {
  const base = getSkinStyle("default");
  return {
    ...base,
    stickerColors: {
      ...base.stickerColors,
      U: base.stickerColors.D, // yellow on top
      D: base.stickerColors.U, // white on bottom
      R: base.stickerColors.L, // orange on right
      L: base.stickerColors.R, // red on left
    },
  };
}

export interface Case3DDiagramProps {
  caseData: AlgorithmCase;
  selectedSlot?: number;
  className?: string;
  showSetup?: boolean;
  /** If true, keeps live WebGL engine running (for detail view). Default: false (uses 3D image snapshot). */
  interactive?: boolean;
}

export function Case3DDiagram({
  caseData,
  selectedSlot = 0,
  className,
  showSetup = false,
  interactive = false,
}: Case3DDiagramProps) {
  const cacheKey = `${caseData.id}_${caseData.setupScramble}_${selectedSlot}`;
  const service = Global3DSnapshotService.getInstance();
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(
    () => service.getCachedSnapshot(cacheKey),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  // If interactive mode is requested (e.g. inside detail panel), use live WebGL canvas directly.
  if (interactive) {
    return (
      <div className="flex flex-col items-center w-full">
        <Case3DCanvas
          caseData={caseData}
          selectedSlot={selectedSlot}
          className={className}
        />
        {showSetup && caseData.setupScramble && (
          <div className="mt-2 text-center text-[0.65rem] text-ink-3">
            <span className="font-semibold text-ink-2">Setup:</span>{" "}
            {caseData.setupScramble}
          </div>
        )}
      </div>
    );
  }

  // Request snapshot when element is visible in/near viewport
  useEffect(() => {
    if (snapshotUrl) return;

    let isMounted = true;
    const el = wrapperRef.current;

    const fetchSnapshot = () => {
      service
        .requestSnapshot(caseData, selectedSlot)
        .then((url) => {
          if (isMounted) setSnapshotUrl(url);
        })
        .catch(() => {
          // Fallback handled via UI
        });
    };

    if (!el || !("IntersectionObserver" in window)) {
      fetchSnapshot();
      return () => {
        isMounted = false;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            fetchSnapshot();
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [caseData, selectedSlot, snapshotUrl, service]);

  return (
    <div ref={wrapperRef} className="flex flex-col items-center w-full">
      <div
        className={cn(
          "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs flex items-center justify-center p-1",
          className,
        )}
      >
        {snapshotUrl ? (
          <img
            src={snapshotUrl}
            alt={caseData.name}
            className="h-full w-full object-contain pointer-events-none"
          />
        ) : (
          <div className="relative w-full h-full animate-pulse flex items-center justify-center bg-surface-2/20 rounded-lg">
            <span className="text-[0.6rem] font-medium text-ink-3/40 font-mono">
              3D
            </span>
          </div>
        )}
      </div>
      {showSetup && caseData.setupScramble && (
        <div className="mt-2 text-center text-[0.65rem] text-ink-3">
          <span className="font-semibold text-ink-2">Setup:</span>{" "}
          {caseData.setupScramble}
        </div>
      )}
    </div>
  );
}

function Case3DCanvas({
  caseData,
  selectedSlot,
  className,
}: {
  caseData: AlgorithmCase;
  selectedSlot: number;
  className?: string;
}) {
  const { canvasRef, containerRef, isReady, engineRef } = useCube3D({
    maxRecentMoves: 0,
  });

  const hasSetCameraRef = useRef(false);
  const isF2L = F2L_SUBSET_IDS.has(caseData.subsetId);

  useEffect(() => {
    if (!isReady || !engineRef.current) return;

    const engine = engineRef.current;
    const modelYRot = SLOT_LABELS[selectedSlot]?.modelYRot ?? 0;

    try {
      if (isF2L) {
        engine.updateStyle(buildF2LSkinStyle());
      } else {
        engine.updateStyle(getSkinStyle("default"));
      }

      if (!hasSetCameraRef.current) {
        engine.sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6);
        hasSetCameraRef.current = true;
      }

      engine.clearLayerGray();
      if (caseData.setupScramble) {
        const rawState = CaseStateGenerator.generateFromScramble(
          caseData.setupScramble,
        );
        const faceletString = CaseStateGenerator.toFaceletString(rawState);
        engine.syncFacelets(faceletString);
      } else {
        engine.resetCube();
      }

      engine.rotateModelY(modelYRot);

      if (isF2L) {
        engine.setF2LMaskGray(F2L_GRAY);
      }

      engine.sceneManager.render();
    } catch {
      engine.resetCube();
    }
  }, [
    isReady,
    engineRef,
    caseData.setupScramble,
    caseData.subsetId,
    selectedSlot,
    isF2L,
  ]);

  useEffect(() => {
    return () => {
      engineRef.current?.clearLayerGray();
    };
  }, [engineRef]);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs",
        className,
      )}
    >
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        className="absolute inset-0 h-full w-full outline-none"
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
          <span className="text-[0.6rem] text-ink-3/50 animate-pulse">
            Rendering 3D...
          </span>
        </div>
      )}
    </div>
  );
}
