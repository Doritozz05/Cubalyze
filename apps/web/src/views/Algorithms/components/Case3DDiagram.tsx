"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import {
  buildCaseRenderPlan,
  resolveAlgorithmViewPreferences,
  type Algorithm,
  type AlgorithmCase,
  type F2LSlotId,
} from "@cubeforge/algorithm-db";
import { Cube3DEngine } from "@cubeforge/cube-3d-engine";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";
import { applyCaseRenderPlan } from "@/services/Case3DRenderAdapter";

type ViewAlgorithm = Pick<
  Algorithm,
  "moves" | "viewPreferences" | "customViewAngle" | "customDiagramRotation"
>;

export interface Case3DDiagramProps {
  caseData: AlgorithmCase;
  /** The selected algorithm contributes view preferences, never case state. */
  algorithm?: ViewAlgorithm | null;
  /** @deprecated Use algorithm.viewPreferences.camera. */
  customViewAngle?: [number, number, number];
  /** @deprecated Kept for source compatibility; moves never define the case view. */
  moves?: string[];
  selectedSlot?: number;
  resetCameraTrigger?: number;
  className?: string;
  showSetup?: boolean;
  /** Live WebGL mode. Without this, the canonical snapshot path is used. */
  interactive?: boolean;
}

function legacyAlgorithm(customViewAngle?: [number, number, number]): ViewAlgorithm | undefined {
  return customViewAngle
    ? { moves: [], customViewAngle }
    : undefined;
}

export function Case3DDiagram({
  caseData,
  algorithm,
  customViewAngle,
  selectedSlot,
  resetCameraTrigger,
  className,
  showSetup = false,
  interactive = false,
}: Case3DDiagramProps) {
  const effectiveAlgorithm = algorithm ?? legacyAlgorithm(customViewAngle);
  const effectiveSlot = selectedSlot ?? resolveAlgorithmViewPreferences(effectiveAlgorithm).preferredF2LSlot ?? 0;
  const effectiveCamera = effectiveAlgorithm?.viewPreferences?.camera
    ?? (effectiveAlgorithm?.customViewAngle
      ? {
          theta: effectiveAlgorithm.customViewAngle[0],
          phi: effectiveAlgorithm.customViewAngle[1],
          radius: effectiveAlgorithm.customViewAngle[2],
        }
      : undefined);
  const effectiveInteractive = interactive || !!effectiveCamera;

  if (effectiveInteractive) {
    const order = caseData.puzzleType === "222" ? 2 : 3;
    return (
      <div className="flex flex-col items-center w-full">
        <Case3DCanvas
          caseData={caseData}
          algorithm={effectiveAlgorithm}
          selectedSlot={effectiveSlot}
          resetCameraTrigger={resetCameraTrigger}
          className={className}
          order={order}
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
      selectedSlot={effectiveSlot}
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
}: Pick<Case3DDiagramProps, "caseData" | "selectedSlot" | "className" | "showSetup">) {
  const cacheKey = `${caseData.id}_${caseData.setupScramble}_${selectedSlot}`;
  const service = Global3DSnapshotService.getInstance();
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(
    () => service.getCachedSnapshot(cacheKey),
  );
  const [prevCacheKey, setPrevCacheKey] = useState(cacheKey);

  if (prevCacheKey !== cacheKey) {
    setPrevCacheKey(cacheKey);
    setSnapshotUrl(service.getCachedSnapshot(cacheKey));
  }

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (snapshotUrl) return;
    let isMounted = true;
    const el = wrapperRef.current;
    const fetchSnapshot = () => {
      service.requestSnapshot(caseData, { selectedSlot }).then((url) => {
        if (isMounted) setSnapshotUrl(url);
      }).catch(() => {
        // The loading placeholder remains visible when WebGL is unavailable.
      });
    };

    if (!el || !("IntersectionObserver" in window)) {
      fetchSnapshot();
      return () => { isMounted = false; };
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        fetchSnapshot();
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(el);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [caseData, selectedSlot, cacheKey, snapshotUrl, service]);

  return (
    <div ref={wrapperRef} className="flex flex-col items-center w-full">
      <div className={cn(
        "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs flex items-center justify-center p-1",
        className,
      )}>
        {snapshotUrl ? (
          <img src={snapshotUrl} alt={caseData.name} className="h-full w-full object-contain pointer-events-none" />
        ) : (
          <div className="relative w-full h-full animate-pulse flex items-center justify-center bg-surface-2/20 rounded-lg">
            <span className="text-[0.6rem] font-medium text-ink-3/40 font-mono">3D</span>
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

export function Case3DCanvas({
  caseData,
  algorithm,
  selectedSlot,
  resetCameraTrigger,
  className,
  order = 3,
  onEngineReady,
  lockOrbit = false,
}: {
  caseData: AlgorithmCase;
  algorithm?: ViewAlgorithm;
  selectedSlot: number;
  resetCameraTrigger?: number;
  className?: string;
  order?: number;
  /** Called when the engine is initialized, so the editor can capture camera state. */
  onEngineReady?: (engine: Cube3DEngine) => void;
  /** Blocks pointer-drag orbit so only explicit controls rotate the camera. */
  lockOrbit?: boolean;
}) {
  const { t } = useTranslation("algorithms");
  const { canvasRef, containerRef, isReady, initFailed, contextEvicted, engineRef, rotateCamera } = useCube3D({
    maxRecentMoves: 0,
    order,
  });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const plan = useMemo(
    () => buildCaseRenderPlan(caseData, {
      selectedF2LSlot: selectedSlot as F2LSlotId,
      algorithm,
    }),
    [caseData, selectedSlot, algorithm],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (lockOrbit) return;
    setIsDragging(true);
    lastPos.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (lockOrbit || !isDragging) return;
    const dx = event.clientX - lastPos.current.x;
    const dy = event.clientY - lastPos.current.y;
    lastPos.current = { x: event.clientX, y: event.clientY };
    rotateCamera(dx, dy);
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (lockOrbit) return;
    setIsDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
  };

  const handleDoubleClick = () => {
    if (lockOrbit || !engineRef.current) return;
    engineRef.current.animateCameraTo(
      plan.camera.theta,
      plan.camera.phi,
      plan.camera.radius,
    );
  };

  useEffect(() => {
    if (isReady && engineRef.current) onEngineReady?.(engineRef.current);
  }, [isReady, engineRef, onEngineReady]);

  useEffect(() => {
    if (!isReady || !engineRef.current) return;
    try {
      applyCaseRenderPlan(engineRef.current, plan);
    } catch {
      engineRef.current.resetCube();
    }
  }, [
    isReady,
    engineRef,
    caseData.id,
    caseData.setupScramble,
    caseData.subsetId,
    selectedSlot,
    resetCameraTrigger,
    order,
    plan,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => engine?.clearLayerGray();
  }, [engineRef]);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={cn(
      "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs",
      className,
    )}>
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "absolute inset-0 h-full w-full outline-none touch-none",
          lockOrbit ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
      />
      {initFailed || contextEvicted ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 px-2">
          <span className="text-[0.58rem] text-ink-3/70 text-center">
            {t("tooMany3DViews")}
          </span>
        </div>
      ) : !isReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
          <span className="text-[0.6rem] text-ink-3/50 animate-pulse">{t("rendering3D")}</span>
        </div>
      ) : null}
    </div>
  );
}
