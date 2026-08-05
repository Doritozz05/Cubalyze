"use client";

import { useEffect } from "react";
import { FloatingCubeButton } from "@/widgets/implementations/cube-button/FloatingCubeButton";
import { widgetStore, useWidgetStore } from "@/widgets/widgetStore";

export interface CubeButtonGateProps {
  cubePanelOpen: boolean;
  smartCubeConnected: boolean;
  onOpenCube: () => void;
}

/**
 * Reads the cube-button's status from the widget store.
 * Only renders the FloatingCubeButton if the user has it toggled ON
 * in the Widget Explorer (status !== "inactive").
 */
export function CubeButtonGate({
  cubePanelOpen,
  smartCubeConnected,
  onOpenCube,
}: CubeButtonGateProps) {
  const status = useWidgetStore((s) => s.instances["cube-button"]?.status);

  // Self-healing: force status back to safe values if corrupted (e.g.
  // old localStorage migration set it to "floating").
  useEffect(() => {
    if (status === "floating" || status === "minimized") {
      widgetStore.getState().setStatus("cube-button", "docked");
    }
  }, [status]);

  if (status === "inactive") return null;

  return (
    <FloatingCubeButton
      onClick={onOpenCube}
      cubePanelOpen={cubePanelOpen}
      smartCubeConnected={smartCubeConnected}
    />
  );
}
