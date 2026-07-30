"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import { Cube2x2State, Cube2x2FaceletConverter } from "@cubeforge/math-core";
import { getSkinStyle } from "@cubeforge/cube-3d-engine";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";

const F2L_ADVANCED_SUBSET_ID = "00000000-0000-4000-9000-000000000004";
const F2L_SUBSET_IDS = new Set([
  "00000000-0000-4000-9000-000000000003", // Basic F2L
  F2L_ADVANCED_SUBSET_ID, // Advanced F2L
]);

const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right", modelYRot: 0 },
  { id: 1, key: "FL", name: "Front Left", modelYRot: -Math.PI / 2 },
  { id: 2, key: "BL", name: "Back Left", modelYRot: Math.PI },
  { id: 3, key: "BR", name: "Back Right", modelYRot: Math.PI / 2 },
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
      R: base.stickerColors.L, // orange on right (FR slot: Green/Orange)
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
  if (interactive) {
    const is2x2 = caseData.puzzleType === '2x2x2';
    return (
      <div className="flex flex-col items-center w-full">
        <Case3DCanvas
          caseData={caseData}
          selectedSlot={selectedSlot}
          className={className}
          order={is2x2 ? 2 : 3}
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

  return (
    <Case3DSnapshotView
      caseData={caseData}
      selectedSlot={selectedSlot}
      className={className}
      showSetup={showSetup}
    />
  );
}

function Case3DSnapshotView({
  caseData,
  selectedSlot = 0,
  className,
  showSetup = false,
}: Omit<Case3DDiagramProps, "interactive">) {
  const cacheKey = `${caseData.id}_${caseData.setupScramble}_${selectedSlot}`;
  const service = Global3DSnapshotService.getInstance();
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(
    () => service.getCachedSnapshot(cacheKey),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  order = 3,
}: {
  caseData: AlgorithmCase;
  selectedSlot: number;
  className?: string;
  order?: number;
}) {
  const { canvasRef, containerRef, isReady, engineRef, rotateCamera } = useCube3D({
    maxRecentMoves: 0,
    order,
  });

  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    rotateCamera(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already lost
    }
  };

  const hasSetCameraRef = useRef(false);
  const is2x2 = order === 2;
  const isF2L = !is2x2 && F2L_SUBSET_IDS.has(caseData.subsetId);

  useEffect(() => {
    if (!isReady || !engineRef.current) return;

    const engine = engineRef.current;
    const modelYRot = is2x2 ? 0 : (SLOT_LABELS[selectedSlot]?.modelYRot ?? 0);

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
        if (is2x2) {
          const state = new Cube2x2State();
          state.applySequence(caseData.setupScramble);
          const facelets = Cube2x2FaceletConverter.toFaceletString(state);
          engine.syncFacelets(facelets);
        } else {
          const rawState = CaseStateGenerator.generateFromScramble(
            caseData.setupScramble,
          );
          const faceletString = CaseStateGenerator.toFaceletString(rawState);
          engine.syncFacelets(faceletString);
        }
      } else {
        engine.resetCube();
      }

      if (!is2x2) {
        engine.rotateModelY(modelYRot);
      }

      const isAdvancedF2L =
        caseData.subsetId === F2L_ADVANCED_SUBSET_ID ||
        Boolean(caseData.tags?.includes("af2l"));

      if (isF2L) {
        engine.setF2LMaskGray(F2L_GRAY, isAdvancedF2L);
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
    is2x2,
    caseData.tags,
    order,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.clearLayerGray();
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 h-full w-full outline-none cursor-grab active:cursor-grabbing touch-none"
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
