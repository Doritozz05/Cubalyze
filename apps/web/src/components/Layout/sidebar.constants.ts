export const COLLAPSED_WIDTH = 56;
export const EXPANDED_WIDTH = 208;
export const HOVER_DELAY = 150;
export const UNHOVER_DELAY = 300;

export const SIDEBAR_MOTION = {
  container: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  label: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  brand: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  indicator: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  panel: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
} as const;
