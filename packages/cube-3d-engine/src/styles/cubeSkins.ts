import type { CubeStyleOptions } from '../core/CubeMeshFactory';

/**
 * Definition of a cube skin.
 *
 * Every skin has a unique `id`, a human-readable `label`, and the
 * full `style` options that the CubeMeshFactory consumes.
 *
 * To add a new skin, just append an entry to `CUBE_SKINS`.
 * No other wiring is needed – the UI (AppearanceSection) and the
 * 3D panel (Cube3DPanel) iterate the registry automatically.
 */
export interface CubeSkin {
  id: string;
  label: string;
  description: string;
  style: CubeStyleOptions;
}

/**
 * Registry of all available cube skins.
 *
 * ── Guidelines for adding skins ──────────────────────────────────────────
 * 1. Give each skin a unique `id` (kebab-case).
 * 2. Provide a short `label` (user-facing, < 24 chars) and a one-line
 *    `description` that explains the visual difference.
 * 3. Define the full `style` object (all fields required by CubeStyleOptions).
 *    There is no inheritance – skins are explicit declarations.
 * 4. The first entry is the default. The preferences store defaults to
 *    `appearance3d: 'default'`.
 */
export const CUBE_SKINS: CubeSkin[] = [
  // ── Default (stickered) ──────────────────────────────────────────────
  {
    id: 'default',
    label: 'Default',
    description: 'Classic stickered look with standard WCA color scheme.',
    style: {
      coreColor: '#1a1a1a',
      coreOpacity: 1.0,
      stickerColors: {
        U: '#ece8e2', // white
        D: '#ffe62a', // yellow
        F: '#1abe57', // green
        B: '#3d7ce0', // blue
        R: '#eb4242', // red
        L: '#ff801f', // orange
      },
    },
  },

  // ── Stickerless ─────────────────────────────────────────────────────
  {
    id: 'stickerless',
    label: 'Stickerless',
    description:
      'Simulates the look of a stickerless speed cube where the plastic itself is coloured. More saturated tones with tighter visual integration between face and body.',
    style: {
      skinType: 'stickerless',
      coreColor: '#1a1a1a',
      coreOpacity: 1.0,
      stickerSize: 0,
      stickerRadius: 0,
      stickerColors: {
        U: '#ece8e2', // white
        D: '#ffe62a', // yellow
        F: '#1abe57', // green
        B: '#3d7ce0', // blue
        R: '#eb4242', // red
        L: '#ff801f', // orange
      },
    },
  },
];

/** Convenience accessor: get a skin by its id. */
export function getSkin(id: string): CubeSkin | undefined {
  return CUBE_SKINS.find((s) => s.id === id);
}

/** Convenience accessor: get the style for a skin id, falling back to default. */
export function getSkinStyle(id: string): CubeStyleOptions {
  const skin = getSkin(id);
  return skin ? { ...skin.style } : { ...CUBE_SKINS[0].style };
}

/** List of skin ids (useful for iteration in UI). */
export const SKIN_IDS: readonly string[] = CUBE_SKINS.map((s) => s.id);
