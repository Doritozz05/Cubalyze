"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import { getSkinStyle } from "@cubeforge/cube-3d-engine";
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

// Global snapshot cache to store generated 3D image data URLs
const SNAPSHOT_CACHE = new Map<string, string>();
const STORAGE_PREFIX = "cubeforge_snap_3d_";

function getCachedSnapshot(key: string): string | null {
  if (SNAPSHOT_CACHE.has(key)) return SNAPSHOT_CACHE.get(key)!;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        SNAPSHOT_CACHE.set(key, stored);
        return stored;
      }
    } catch {
      // sessionStorage unavailable or access denied
    }
  }
  return null;
}

function setCachedSnapshot(key: string, dataUrl: string) {
  SNAPSHOT_CACHE.set(key, dataUrl);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, dataUrl);
    } catch {
      // Storage quota exceeded or unavailable
    }
  }
}

// Global Concurrency Queue to prevent WebGL Context Limits & Main Thread Freezes
type Task = () => void;

class WebGLQueue {
  private activeCount = 0;
  private maxConcurrent = 1; // Only 1 WebGL snapshot engine active at any moment
  private queue: Task[] = [];

  acquire(run: Task): () => void {
    let cancelled = false;

    const task = () => {
      if (cancelled) {
        this.release();
        return;
      }
      this.activeCount++;
      run();
    };

    if (this.activeCount < this.maxConcurrent) {
      task();
    } else {
      this.queue.push(task);
    }

    return () => {
      cancelled = true;
      const idx = this.queue.indexOf(task);
      if (idx !== -1) {
        this.queue.splice(idx, 1);
      }
    };
  }

  release() {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

const renderQueue = new WebGLQueue();

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
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(
    () => getCachedSnapshot(cacheKey),
  );

  // If a snapshot is cached and we don't require an interactive 3D canvas, render static 3D image instantly!
  if (!interactive && snapshotUrl) {
    return (
      <div className="flex flex-col items-center w-full">
        <div
          className={cn(
            "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs flex items-center justify-center p-1",
            className,
          )}
        >
          <img
            src={snapshotUrl}
            alt={caseData.name}
            className="h-full w-full object-contain pointer-events-none"
          />
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

  return (
    <Case3DDiagramCore
      caseData={caseData}
      selectedSlot={selectedSlot}
      className={className}
      showSetup={showSetup}
      interactive={interactive}
      onSnapshot={(url) => {
        setCachedSnapshot(cacheKey, url);
        setSnapshotUrl(url);
      }}
    />
  );
}

function Case3DDiagramCore({
  caseData,
  selectedSlot,
  className,
  showSetup,
  interactive,
  onSnapshot,
}: {
  caseData: AlgorithmCase;
  selectedSlot: number;
  className?: string;
  showSetup: boolean;
  interactive: boolean;
  onSnapshot: (url: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [canRender3D, setCanRender3D] = useState(interactive);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Queue acquisition when visible and non-interactive
  useEffect(() => {
    if (!isVisible || interactive) return;

    const cancel = renderQueue.acquire(() => {
      setCanRender3D(true);
    });

    return () => {
      cancel();
    };
  }, [isVisible, interactive]);

  const handleSnapshot = (url: string) => {
    if (!interactive) {
      renderQueue.release();
    }
    onSnapshot(url);
  };

  return (
    <div ref={wrapperRef} className="flex flex-col items-center w-full">
      {isVisible && canRender3D ? (
        <Case3DCanvas
          caseData={caseData}
          selectedSlot={selectedSlot}
          className={className}
          interactive={interactive}
          onSnapshot={handleSnapshot}
        />
      ) : (
        <div
          className={cn(
            "relative w-full aspect-square rounded-xl border border-line bg-surface-2/30 animate-pulse flex items-center justify-center",
            className,
          )}
        >
          <span className="text-[0.6rem] text-ink-3/40 font-mono">3D</span>
        </div>
      )}

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
  interactive,
  onSnapshot,
}: {
  caseData: AlgorithmCase;
  selectedSlot: number;
  className?: string;
  interactive: boolean;
  onSnapshot: (url: string) => void;
}) {
  const { canvasRef, containerRef, isReady, engineRef } = useCube3D({
    maxRecentMoves: 0,
  });

  const hasSetCameraRef = useRef(false);
  const isF2L = F2L_SUBSET_IDS.has(caseData.subsetId);
  const hasCapturedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!interactive && !hasCapturedRef.current) {
        renderQueue.release();
      }
    };
  }, [interactive]);

  useEffect(() => {
    if (!isReady || !engineRef.current || hasCapturedRef.current) return;

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

      // Synchronously trigger 3D scene render
      engine.sceneManager.render();

      // Immediately snapshot canvas to data URL & notify parent to switch to static <img>
      if (!interactive && canvasRef.current) {
        hasCapturedRef.current = true;
        try {
          const dataUrl = canvasRef.current.toDataURL("image/png");
          if (dataUrl && dataUrl.length > 100) {
            onSnapshot(dataUrl);
          }
        } catch {
          // fallback
        }
      }
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
    interactive,
    canvasRef,
    onSnapshot,
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
