"use client";

import { Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { Scramble2DNet } from "@/components/Scramble/Scramble2DNet";

export interface FloatingCube2DPanelProps {
  scramble?: string;
  className?: string;
}

/**
 * Floating 2D cube net panel showing the current scramble state.
 *
 * Auto-detects 2×2 vs 3×3 from the scramble notation (see `Scramble2DNet`):
 *   • 2×2: only U/R/F moves → uses Cube2x2State + 24-char facelets
 *   • 3×3: all move types → uses CubeState + 54-char facelets (original behavior)
 */
export function FloatingCube2DPanel({ scramble, className }: FloatingCube2DPanelProps) {
  const { t } = useTranslation("widgets");

  return (
    <FloatingWidgetWrapper
      widgetId="scramble-2d"
      icon={Shuffle}
      label={t("def.scramble2d")}
      defaultPosition={{ x: 24, y: 440 }}
      className={className}
    >
      <div className="p-2.5 flex justify-center items-center overflow-visible">
        <Scramble2DNet scramble={scramble} />
      </div>
    </FloatingWidgetWrapper>
  );
}
