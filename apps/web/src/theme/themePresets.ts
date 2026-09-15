/**
 * Cubalyze Theme Presets & Color Token Registry.
 *
 * Provides curated, aesthetic palettes and utilities to resolve active tokens
 * for the web app, live scaled preview, and theme synchronization.
 */

export interface ThemeColors {
  // Surfaces
  '--canvas': string;
  '--surface': string;
  '--surface-2': string;
  '--line': string;
  '--line-2': string;

  // Text & Typography
  '--ink': string;
  '--ink-2': string;
  '--ink-3': string;

  // Timer Accents & States
  '--ready': string;
  '--ready-soft': string;
  '--hold': string;
  '--hold-soft': string;
  '--dnf': string;
  '--dnf-soft': string;
  '--plus2': string;
  '--plus2-soft': string;
  '--caution': string;
  '--caution-soft': string;
}

export type ThemeTokenKey = keyof ThemeColors;

export interface ThemePreset {
  id: string;
  labelKey: string;
  descriptionKey: string;
  isDark: boolean;
  colors: ThemeColors;
  /** User-created themes carry their editable name here (wins over labelKey). */
  customName?: string;
  previewColors: {
    canvas: string;
    surface: string;
    ink: string;
    accent: string;
  };
}

export const DEFAULT_LIGHT_COLORS: ThemeColors = {
  '--canvas': '#f8f9fa',
  '--surface': '#ffffff',
  '--surface-2': '#f1f3f5',
  '--line': '#e9ecef',
  '--line-2': '#dee2e6',
  '--ink': '#212529',
  '--ink-2': '#495057',
  '--ink-3': '#667085',
  '--ready': '#2b7749',
  '--ready-soft': '#e7f1ea',
  '--hold': '#8c3c34',
  '--hold-soft': '#fbeae8',
  '--dnf': '#b3261e',
  '--dnf-soft': '#fcebec',
  '--plus2': '#ea580c',
  '--plus2-soft': '#ffedd5',
  '--caution': '#d97706',
  '--caution-soft': '#fef3c7',
};

export const DEFAULT_DARK_COLORS: ThemeColors = {
  '--canvas': '#14171b',
  '--surface': '#1b1f23',
  '--surface-2': '#24292e',
  '--line': '#2a2f35',
  '--line-2': '#343a40',
  '--ink': '#e9ecef',
  '--ink-2': '#adb5bd',
  '--ink-3': '#9099a3',
  '--ready': '#6abf8a',
  '--ready-soft': 'rgba(106, 191, 138, 0.14)',
  '--hold': '#e0857c',
  '--hold-soft': 'rgba(224, 133, 124, 0.14)',
  '--dnf': '#e06a5f',
  '--dnf-soft': 'rgba(224, 106, 95, 0.14)',
  '--plus2': '#d9a441',
  '--plus2-soft': 'rgba(217, 164, 65, 0.14)',
  '--caution': '#facc15',
  '--caution-soft': 'rgba(250, 204, 21, 0.14)',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark',
    labelKey: 'appearance.presetDark',
    descriptionKey: 'appearance.presetDarkDesc',
    isDark: true,
    colors: DEFAULT_DARK_COLORS,
    previewColors: {
      canvas: '#14171b',
      surface: '#1b1f23',
      ink: '#e9ecef',
      accent: '#6abf8a',
    },
  },
  {
    id: 'light',
    labelKey: 'appearance.presetLight',
    descriptionKey: 'appearance.presetLightDesc',
    isDark: false,
    colors: DEFAULT_LIGHT_COLORS,
    previewColors: {
      canvas: '#f8f9fa',
      surface: '#ffffff',
      ink: '#212529',
      accent: '#2b7749',
    },
  },
  {
    id: 'midnight',
    labelKey: 'appearance.presetMidnight',
    descriptionKey: 'appearance.presetMidnightDesc',
    isDark: true,
    colors: {
      '--canvas': '#000000',
      '--surface': '#0c0d0f',
      '--surface-2': '#16181d',
      '--line': '#242830',
      '--line-2': '#303642',
      '--ink': '#ffffff',
      '--ink-2': '#c5cbd3',
      '--ink-3': '#788290',
      '--ready': '#34d399',
      '--ready-soft': 'rgba(52, 211, 153, 0.14)',
      '--hold': '#f87171',
      '--hold-soft': 'rgba(248, 113, 113, 0.14)',
      '--dnf': '#ef4444',
      '--dnf-soft': 'rgba(239, 68, 68, 0.14)',
      '--plus2': '#fbbf24',
      '--plus2-soft': 'rgba(251, 191, 36, 0.14)',
      '--caution': '#facc15',
      '--caution-soft': 'rgba(250, 204, 21, 0.14)',
    },
    previewColors: {
      canvas: '#000000',
      surface: '#0c0d0f',
      ink: '#ffffff',
      accent: '#34d399',
    },
  },
  {
    id: 'catppuccin-mocha',
    labelKey: 'appearance.presetCatppuccinMocha',
    descriptionKey: 'appearance.presetCatppuccinMochaDesc',
    isDark: true,
    colors: {
      '--canvas': '#1e1e2e',
      '--surface': '#181825',
      '--surface-2': '#313244',
      '--line': '#45475a',
      '--line-2': '#585b70',
      '--ink': '#cdd6f4',
      '--ink-2': '#bac2de',
      '--ink-3': '#7f849c',
      '--ready': '#a6e3a1',
      '--ready-soft': 'rgba(166, 227, 161, 0.14)',
      '--hold': '#eba0ac',
      '--hold-soft': 'rgba(235, 160, 172, 0.14)',
      '--dnf': '#f38ba8',
      '--dnf-soft': 'rgba(243, 139, 168, 0.14)',
      '--plus2': '#fab387',
      '--plus2-soft': 'rgba(250, 179, 135, 0.14)',
      '--caution': '#f9e2af',
      '--caution-soft': 'rgba(249, 226, 175, 0.14)',
    },
    previewColors: {
      canvas: '#1e1e2e',
      surface: '#181825',
      ink: '#cdd6f4',
      accent: '#cba6f7',
    },
  },
  {
    id: 'rose-pine',
    labelKey: 'appearance.presetRosePine',
    descriptionKey: 'appearance.presetRosePineDesc',
    isDark: true,
    colors: {
      '--canvas': '#191724',
      '--surface': '#1f1d2e',
      '--surface-2': '#26233a',
      '--line': '#403d52',
      '--line-2': '#524f67',
      '--ink': '#e0def4',
      '--ink-2': '#908caa',
      '--ink-3': '#6e6a86',
      '--ready': '#9ccfd8',
      '--ready-soft': 'rgba(156, 207, 216, 0.14)',
      '--hold': '#ebbcba',
      '--hold-soft': 'rgba(235, 188, 186, 0.14)',
      '--dnf': '#eb6f92',
      '--dnf-soft': 'rgba(235, 111, 146, 0.14)',
      '--plus2': '#ea9a97',
      '--plus2-soft': 'rgba(234, 154, 151, 0.14)',
      '--caution': '#f6c177',
      '--caution-soft': 'rgba(246, 193, 119, 0.14)',
    },
    previewColors: {
      canvas: '#191724',
      surface: '#1f1d2e',
      ink: '#e0def4',
      accent: '#ebbcba',
    },
  },
  {
    id: 'nord',
    labelKey: 'appearance.presetNord',
    descriptionKey: 'appearance.presetNordDesc',
    isDark: true,
    colors: {
      '--canvas': '#2e3440',
      '--surface': '#3b4252',
      '--surface-2': '#434c5e',
      '--line': '#4c566a',
      '--line-2': '#3b4252',
      '--ink': '#eceff4',
      '--ink-2': '#e5e9f0',
      '--ink-3': '#d8dee9',
      '--ready': '#a3be8c',
      '--ready-soft': 'rgba(163, 190, 140, 0.14)',
      '--hold': '#bf616a',
      '--hold-soft': 'rgba(191, 97, 106, 0.14)',
      '--dnf': '#bf616a',
      '--dnf-soft': 'rgba(191, 97, 106, 0.14)',
      '--plus2': '#d08770',
      '--plus2-soft': 'rgba(208, 135, 112, 0.14)',
      '--caution': '#ebcb8b',
      '--caution-soft': 'rgba(235, 203, 139, 0.14)',
    },
    previewColors: {
      canvas: '#2e3440',
      surface: '#3b4252',
      ink: '#eceff4',
      accent: '#88c0d0',
    },
  },
  {
    id: 'catppuccin-latte',
    labelKey: 'appearance.presetCatppuccinLatte',
    descriptionKey: 'appearance.presetCatppuccinLatteDesc',
    isDark: false,
    colors: {
      '--canvas': '#eff1f5',
      '--surface': '#e6e9ef',
      '--surface-2': '#ccd0da',
      '--line': '#bcc0cc',
      '--line-2': '#acb0be',
      '--ink': '#4c4f69',
      '--ink-2': '#5c5f77',
      '--ink-3': '#6c6f85',
      '--ready': '#40a02b',
      '--ready-soft': 'rgba(64, 160, 43, 0.14)',
      '--hold': '#e64553',
      '--hold-soft': 'rgba(230, 69, 83, 0.14)',
      '--dnf': '#d20f39',
      '--dnf-soft': 'rgba(210, 15, 57, 0.14)',
      '--plus2': '#fe640b',
      '--plus2-soft': 'rgba(254, 100, 11, 0.14)',
      '--caution': '#df8e1d',
      '--caution-soft': 'rgba(223, 142, 29, 0.14)',
    },
    previewColors: {
      canvas: '#eff1f5',
      surface: '#e6e9ef',
      ink: '#4c4f69',
      accent: '#8839ef',
    },
  },
  {
    id: 'tokyo-night',
    labelKey: 'appearance.presetTokyoNight',
    descriptionKey: 'appearance.presetTokyoNightDesc',
    isDark: true,
    colors: {
      '--canvas': '#1a1b26',
      '--surface': '#16161e',
      '--surface-2': '#24283b',
      '--line': '#2f3549',
      '--line-2': '#414868',
      '--ink': '#c0caf5',
      '--ink-2': '#9aa5ce',
      '--ink-3': '#565f89',
      '--ready': '#73daca',
      '--ready-soft': 'rgba(115, 218, 202, 0.14)',
      '--hold': '#f7768e',
      '--hold-soft': 'rgba(247, 118, 142, 0.14)',
      '--dnf': '#f7768e',
      '--dnf-soft': 'rgba(247, 118, 142, 0.14)',
      '--plus2': '#ff9e64',
      '--plus2-soft': 'rgba(255, 158, 100, 0.14)',
      '--caution': '#e0af68',
      '--caution-soft': 'rgba(224, 175, 104, 0.14)',
    },
    previewColors: {
      canvas: '#1a1b26',
      surface: '#16161e',
      ink: '#c0caf5',
      accent: '#7aa2f7',
    },
  },
  {
    id: 'gruvbox-dark',
    labelKey: 'appearance.presetGruvbox',
    descriptionKey: 'appearance.presetGruvboxDesc',
    isDark: true,
    colors: {
      '--canvas': '#282828',
      '--surface': '#1d2021',
      '--surface-2': '#32302f',
      '--line': '#3c3836',
      '--line-2': '#504945',
      '--ink': '#ebdbb2',
      '--ink-2': '#d5c4a1',
      '--ink-3': '#a89984',
      '--ready': '#b8bb26',
      '--ready-soft': 'rgba(184, 187, 38, 0.14)',
      '--hold': '#fb4934',
      '--hold-soft': 'rgba(251, 73, 52, 0.14)',
      '--dnf': '#cc241d',
      '--dnf-soft': 'rgba(204, 36, 29, 0.14)',
      '--plus2': '#fe8019',
      '--plus2-soft': 'rgba(254, 128, 25, 0.14)',
      '--caution': '#fabd2f',
      '--caution-soft': 'rgba(250, 189, 47, 0.14)',
    },
    previewColors: {
      canvas: '#282828',
      surface: '#1d2021',
      ink: '#ebdbb2',
      accent: '#fabd2f',
    },
  },
  {
    id: 'dracula',
    labelKey: 'appearance.presetDracula',
    descriptionKey: 'appearance.presetDraculaDesc',
    isDark: true,
    colors: {
      '--canvas': '#282a36',
      '--surface': '#21222c',
      '--surface-2': '#343746',
      '--line': '#44475a',
      '--line-2': '#6272a4',
      '--ink': '#f8f8f2',
      '--ink-2': '#bfbfbf',
      '--ink-3': '#6272a4',
      '--ready': '#50fa7b',
      '--ready-soft': 'rgba(80, 250, 123, 0.14)',
      '--hold': '#ff5555',
      '--hold-soft': 'rgba(255, 85, 85, 0.14)',
      '--dnf': '#ff5555',
      '--dnf-soft': 'rgba(255, 85, 85, 0.14)',
      '--plus2': '#ffb86c',
      '--plus2-soft': 'rgba(255, 184, 108, 0.14)',
      '--caution': '#f1fa8c',
      '--caution-soft': 'rgba(241, 250, 140, 0.14)',
    },
    previewColors: {
      canvas: '#282a36',
      surface: '#21222c',
      ink: '#f8f8f2',
      accent: '#bd93f9',
    },
  },
  {
    id: 'cyberpunk',
    labelKey: 'appearance.presetCyberpunk',
    descriptionKey: 'appearance.presetCyberpunkDesc',
    isDark: true,
    colors: {
      '--canvas': '#090a0f',
      '--surface': '#12131c',
      '--surface-2': '#1b1d2a',
      '--line': '#2d3148',
      '--line-2': '#43496d',
      '--ink': '#f0f6fc',
      '--ink-2': '#c5cee0',
      '--ink-3': '#79839e',
      '--ready': '#00f0ff',
      '--ready-soft': 'rgba(0, 240, 255, 0.14)',
      '--hold': '#ff0055',
      '--hold-soft': 'rgba(255, 0, 85, 0.14)',
      '--dnf': '#ff0055',
      '--dnf-soft': 'rgba(255, 0, 85, 0.14)',
      '--plus2': '#ff7700',
      '--plus2-soft': 'rgba(255, 119, 0, 0.14)',
      '--caution': '#fcee0a',
      '--caution-soft': 'rgba(252, 238, 10, 0.14)',
    },
    previewColors: {
      canvas: '#090a0f',
      surface: '#12131c',
      ink: '#f0f6fc',
      accent: '#00f0ff',
    },
  },
];

/**
 * Reads the OS color scheme. SSR-safe (defaults to light outside the browser).
 * Used as the single source of truth for `system` mode: system always resolves
 * to one of the two classic presets (light / dark), never to a fancy preset.
 */
export function getSystemBaseTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

import type { CustomTheme } from '@cubalyze/state';

/**
 * Resolves the complete map of CSS variables given the preset, base light/dark mode,
 * and any user overrides. `customThemes` lets user-created full themes resolve
 * exactly like built-in presets.
 */
export function resolveThemeColors(
  presetId: string,
  baseTheme: 'light' | 'dark' | 'system',
  customColors?: Record<string, string> | null,
  customThemes: CustomTheme[] = [],
): ThemeColors {
  const base = baseTheme === 'system' ? getSystemBaseTheme() : baseTheme;
  let effectiveId = presetId;
  if (!effectiveId || effectiveId === 'default') {
    effectiveId = base;
  }

  const preset = THEME_PRESETS.find((p) => p.id === effectiveId);
  const custom = !preset ? customThemes.find((c) => c.id === effectiveId) : undefined;
  const baseColors: ThemeColors = preset
    ? { ...preset.colors }
    : custom
      ? ({ ...custom.colors } as unknown as ThemeColors)
      : effectiveId === 'light'
        ? { ...DEFAULT_LIGHT_COLORS }
        : { ...DEFAULT_DARK_COLORS };

  if (customColors) {
    return {
      ...baseColors,
      ...customColors,
    };
  }

  return baseColors;
}

/**
 * Derives shadcn / Radix / base Tailwind variables from the resolved theme colors
 * so that sidebars, dropdowns, buttons, cards and dialogs stay synchronized.
 */
export function getDerivedThemeTokens(colors: ThemeColors): Record<string, string> {
  return {
    '--surface-solid': colors['--surface'],
    '--sidebar': colors['--surface'],
    '--sidebar-foreground': colors['--ink'],
    '--sidebar-border': colors['--line'],
    '--sidebar-accent': colors['--surface-2'],
    '--sidebar-accent-foreground': colors['--ink'],
    '--popover': colors['--surface'],
    '--popover-foreground': colors['--ink'],
    '--border': colors['--line'],
    '--input': colors['--line'],
    '--background': colors['--canvas'],
    '--foreground': colors['--ink'],
    '--card': colors['--surface'],
    '--card-foreground': colors['--ink'],
    '--primary': colors['--ink'],
    '--primary-foreground': colors['--surface'],
    '--secondary': colors['--surface-2'],
    '--secondary-foreground': colors['--ink'],
    '--muted': colors['--surface-2'],
    '--muted-foreground': colors['--ink-3'],
    '--accent': colors['--surface-2'],
    '--accent-foreground': colors['--ink'],
  };
}

/**
 * Detects a dark canvas from its relative luminance. Used to pick the correct
 * glass hairline color (white-on-dark, black-on-light) without threading
 * preset metadata through every caller.
 */
function canvasIsDark(colors: ThemeColors): boolean {
  const raw = (colors['--canvas'] ?? '').trim();
  let r: number | undefined;
  let g: number | undefined;
  let b: number | undefined;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(raw);
    if (m) {
      r = Number(m[1]);
      g = Number(m[2]);
      b = Number(m[3]);
    }
  }
  if (r === undefined || g === undefined || b === undefined) return false;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/**
 * Derives dynamic frosted glass colors from the active theme's surface tokens,
 * ensuring Liquid Glass looks native across Light, Dark, Midnight OLED, etc.
 *
 * For the classic presets (light / dark / default) the hairline border
 * intentionally does NOT reuse the solid `--line` token: color-mixing an
 * opaque line color yields a heavy gray/white frame. Instead it reproduces
 * the original translucent hairline (black-on-light, white-on-dark) so
 * panel, sidebar and dialog edges stay subtle. Non-classic presets keep
 * their line-tinted glass border (`classicHairline: false`).
 */
export function getDerivedLiquidGlassTokens(
  colors: ThemeColors,
  opacityPercent: number,
  isDark: boolean = canvasIsDark(colors),
  classicHairline: boolean = true,
): Record<string, string> {
  const op = Math.max(0.15, Math.min(0.95, opacityPercent / 100));
  const borderAlpha = isDark ? 0.06 + op * 0.08 : 0.04 + op * 0.06;
  return {
    '--glass-opacity': `${op}`,
    '--glass-bg': `color-mix(in srgb, ${colors['--surface']} ${Math.round(op * 100)}%, transparent)`,
    '--glass-bg-subtle': `color-mix(in srgb, ${colors['--surface-2']} ${Math.round(op * 75)}%, transparent)`,
    '--glass-btn-bg': `color-mix(in srgb, ${colors['--surface-2']} ${Math.round(op * 80)}%, transparent)`,
    '--glass-btn-bg-hover': `color-mix(in srgb, ${colors['--surface-2']} ${Math.round(op * 95)}%, transparent)`,
    '--glass-nested-bg': `color-mix(in srgb, ${colors['--surface']} ${Math.round(op * 35)}%, transparent)`,
    '--glass-nested-blur': `calc(var(--glass-blur) * 0.5)`,
    '--glass-border': classicHairline
      ? `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${borderAlpha.toFixed(3)})`
      : `color-mix(in srgb, ${colors['--line']} ${Math.round((0.5 + op * 0.5) * 100)}%, transparent)`,
  };
}

