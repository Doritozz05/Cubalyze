import { getSkinStyle, type Cube3DEngine } from "@cubeforge/cube-3d-engine";
import {
  CASE_RENDER_GRAY,
  type CaseRenderPlan,
} from "@cubeforge/algorithm-db";

/**
 * Apply a renderer-neutral case plan to the 3D engine.
 *
 * This is intentionally the only web-layer translation from case presentation
 * data to engine operations. Snapshots and interactive canvases must use it.
 */
export function applyCaseRenderPlan(
  engine: Cube3DEngine,
  plan: CaseRenderPlan,
): void {
  const baseStyle = getSkinStyle("default");
  // A stickerColor override is authoritative: it replaces the per-face skin
  // colors (and skips the F2L diagram swap) so a render can show the
  // reconstruction's real colors. Without it, F2L/2×2 cases use the diagram
  // convention (cross face painted as the U color) so the pair reads "up".
  const style = plan.stickerColors
    ? {
        ...baseStyle,
        stickerColors: {
          ...baseStyle.stickerColors,
          ...plan.stickerColors,
        },
      }
    : plan.isF2L || plan.order === 2
      ? {
          ...baseStyle,
          stickerColors: {
            ...baseStyle.stickerColors,
            U: baseStyle.stickerColors.D,
            D: baseStyle.stickerColors.U,
            R: baseStyle.stickerColors.L,
            L: baseStyle.stickerColors.R,
          },
        }
      : baseStyle;

  engine.updateStyle(style);
  engine.sceneManager.setOrbitAngles(
    plan.camera.theta,
    plan.camera.phi,
    plan.camera.radius,
  );
  engine.clearLayerGray();
  engine.syncFacelets(plan.engineFacelets);

  if (plan.order === 3) {
    engine.rotateModelY(plan.modelRotationY);
  }

  if (plan.isF2L) {
    engine.setF2LMaskGray(CASE_RENDER_GRAY, plan.pair);
  }

  engine.sceneManager.render();
}
