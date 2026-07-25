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
 *
 * ── Skin type overview ───────────────────────────────────────────────────
 * - `stickered`:   Classic black core + colored sticker panels.
 * - `stickerless`: Solid colored plastic pieces with subtle seams.
 *                  Each cubie is a complete colored body; no stickers.
 * - `coreless`:    Only the colored face panels are visible — no body.
 *                  Clean digital cube aesthetic.
 */
export const CUBE_SKINS: CubeSkin[] = [
  // ── Default (stickered) ──────────────────────────────────────────────
  {
    id: 'default',
    label: 'Default',
    description: 'Classic stickered look with standard WCA color scheme.',
    style: {
      skinType: 'stickered',
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

  // ── Stickerless (professional speedcube look) ────────────────────────
  {
    id: 'stickerless',
    label: 'Stickerless',
    description:
      'Professional stickerless look. Each piece is solid colored plastic with subtle seams between cubies — just like a premium speedcube.',
    style: {
      skinType: 'stickerless',
      coreColor: '#1a1a1a',
      coreOpacity: 1.0,
      seamColor: '#2a2a2a',
      cubieSize: 0.985,
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

  // ── Coreless (digital cube — floating panels only) ───────────────────
  {
    id: 'coreless',
    label: 'Coreless',
    description:
      'Modern digital cube aesthetic. Only the colored face panels float in space — no visible body. Clean, minimalist look.',
    style: {
      skinType: 'coreless',
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

  // ── Translucent (ghost cube — see-through core) ─────────────────────
  {
    id: 'translucent',
    label: 'Translucent',
    description:
      'Ghostly see-through body. Back-face stickers render through the transparent core — you can see all faces at once. Ethereal look.',
    style: {
      skinType: 'translucent',
      coreColor: '#1a1a1a',
      coreOpacity: 0.0,
      stickerSize: 0.71,
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

  // ── Custom (user-editable sticker colors) ─────────────────────────────
  {
    id: 'custom',
    label: 'Custom',
    description:
      'Your own color scheme. Pick colors for each face using the color pickers below.',
    style: {
      skinType: 'stickered',
      coreColor: '#1a1a1a',
      coreOpacity: 1.0,
      stickerColors: {
        U: '#ece8e2',
        D: '#ffe62a',
        F: '#1abe57',
        B: '#3d7ce0',
        R: '#eb4242',
        L: '#ff801f',
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
