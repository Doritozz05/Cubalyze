/**
 * Cubeforge Theme Presets & Color Token Registry.
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
  '--accent-emerald': string;
}

export type ThemeTokenKey = keyof ThemeColors;

export interface ThemePreset {
  id: string;
  labelKey: string;
  descriptionKey: string;
  isDark: boolean;
  colors: ThemeColors;
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
  '--accent-emerald': '#047857',
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
  '--accent-emerald': '#34d399',
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
      '--accent-emerald': '#10b981',
    },
    previewColors: {
      canvas: '#000000',
      surface: '#0c0d0f',
      ink: '#ffffff',
      accent: '#34d399',
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
      '--line-2': '#5e6a82',
      '--ink': '#eceff4',
      '--ink-2': '#d8dee9',
      '--ink-3': '#88c0d0',
      '--ready': '#a3be8c',
      '--ready-soft': 'rgba(163, 190, 140, 0.15)',
      '--hold': '#bf616a',
      '--hold-soft': 'rgba(191, 97, 106, 0.15)',
      '--dnf': '#d08770',
      '--dnf-soft': 'rgba(208, 135, 112, 0.15)',
      '--plus2': '#ebcb8b',
      '--plus2-soft': 'rgba(235, 203, 139, 0.15)',
      '--caution': '#ebcb8b',
      '--caution-soft': 'rgba(235, 203, 139, 0.15)',
      '--accent-emerald': '#88c0d0',
    },
    previewColors: {
      canvas: '#2e3440',
      surface: '#3b4252',
      ink: '#eceff4',
      accent: '#88c0d0',
    },
  },
  {
    id: 'cyberpunk',
    labelKey: 'appearance.presetCyberpunk',
    descriptionKey: 'appearance.presetCyberpunkDesc',
    isDark: true,
    colors: {
      '--canvas': '#090814',
      '--surface': '#131124',
      '--surface-2': '#1d1936',
      '--line': '#2d2650',
      '--line-2': '#3e356e',
      '--ink': '#f8f8f2',
      '--ink-2': '#00f0ff',
      '--ink-3': '#a37acc',
      '--ready': '#00ff9f',
      '--ready-soft': 'rgba(0, 255, 159, 0.16)',
      '--hold': '#ff0055',
      '--hold-soft': 'rgba(255, 0, 85, 0.16)',
      '--dnf': '#ff0055',
      '--dnf-soft': 'rgba(255, 0, 85, 0.16)',
      '--plus2': '#ffe600',
      '--plus2-soft': 'rgba(255, 230, 0, 0.16)',
      '--caution': '#ffe600',
      '--caution-soft': 'rgba(255, 230, 0, 0.16)',
      '--accent-emerald': '#00f0ff',
    },
    previewColors: {
      canvas: '#090814',
      surface: '#131124',
      ink: '#00f0ff',
      accent: '#ff0055',
    },
  },
  {
    id: 'forest',
    labelKey: 'appearance.presetForest',
    descriptionKey: 'appearance.presetForestDesc',
    isDark: true,
    colors: {
      '--canvas': '#111814',
      '--surface': '#18241e',
      '--surface-2': '#22322a',
      '--line': '#2d4237',
      '--line-2': '#3a5446',
      '--ink': '#edf5ef',
      '--ink-2': '#b7d4bf',
      '--ink-3': '#7da386',
      '--ready': '#4ade80',
      '--ready-soft': 'rgba(74, 222, 128, 0.15)',
      '--hold': '#f87171',
      '--hold-soft': 'rgba(248, 113, 113, 0.15)',
      '--dnf': '#ef4444',
      '--dnf-soft': 'rgba(239, 68, 68, 0.15)',
      '--plus2': '#facc15',
      '--plus2-soft': 'rgba(250, 204, 21, 0.15)',
      '--caution': '#facc15',
      '--caution-soft': 'rgba(250, 204, 21, 0.15)',
      '--accent-emerald': '#34d399',
    },
    previewColors: {
      canvas: '#111814',
      surface: '#18241e',
      ink: '#edf5ef',
      accent: '#4ade80',
    },
  },
  {
    id: 'sunset',
    labelKey: 'appearance.presetSunset',
    descriptionKey: 'appearance.presetSunsetDesc',
    isDark: true,
    colors: {
      '--canvas': '#181211',
      '--surface': '#241a18',
      '--surface-2': '#322320',
      '--line': '#44302c',
      '--line-2': '#563e39',
      '--ink': '#fdedea',
      '--ink-2': '#dcb3ab',
      '--ink-3': '#9f7870',
      '--ready': '#34d399',
      '--ready-soft': 'rgba(52, 211, 153, 0.14)',
      '--hold': '#f97316',
      '--hold-soft': 'rgba(249, 115, 22, 0.14)',
      '--dnf': '#ef4444',
      '--dnf-soft': 'rgba(239, 68, 68, 0.14)',
      '--plus2': '#fbbf24',
      '--plus2-soft': 'rgba(251, 191, 36, 0.14)',
      '--caution': '#fbbf24',
      '--caution-soft': 'rgba(251, 191, 36, 0.14)',
      '--accent-emerald': '#f97316',
    },
    previewColors: {
      canvas: '#181211',
      surface: '#241a18',
      ink: '#fdedea',
      accent: '#f97316',
    },
  },
  {
    id: 'tokyo-night',
    labelKey: 'appearance.presetTokyoNight',
    descriptionKey: 'appearance.presetTokyoNightDesc',
    isDark: true,
    colors: {
      '--canvas': '#16161e',
      '--surface': '#1f2335',
      '--surface-2': '#292e42',
      '--line': '#3b4261',
      '--line-2': '#4e577d',
      '--ink': '#c0caf5',
      '--ink-2': '#9aa5ce',
      '--ink-3': '#7aa2f7',
      '--ready': '#9ece6a',
      '--ready-soft': 'rgba(158, 206, 106, 0.15)',
      '--hold': '#f7768e',
      '--hold-soft': 'rgba(247, 118, 142, 0.15)',
      '--dnf': '#f7768e',
      '--dnf-soft': 'rgba(247, 118, 142, 0.15)',
      '--plus2': '#e0af68',
      '--plus2-soft': 'rgba(224, 175, 104, 0.15)',
      '--caution': '#e0af68',
      '--caution-soft': 'rgba(224, 175, 104, 0.15)',
      '--accent-emerald': '#7aa2f7',
    },
    previewColors: {
      canvas: '#16161e',
      surface: '#1f2335',
      ink: '#c0caf5',
      accent: '#bb9af7',
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

/**
 * Resolves the complete map of CSS variables given the preset, base light/dark mode,
 * and any user overrides.
 */
export function resolveThemeColors(
  presetId: string,
  baseTheme: 'light' | 'dark' | 'system',
  customColors?: Record<string, string> | null,
): ThemeColors {
  const base = baseTheme === 'system' ? getSystemBaseTheme() : baseTheme;
  let effectiveId = presetId;
  if (!effectiveId || effectiveId === 'default') {
    effectiveId = base;
  }

  const preset = THEME_PRESETS.find((p) => p.id === effectiveId);
  const baseColors: ThemeColors = preset
    ? { ...preset.colors }
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
 * ensuring Liquid Glass looks native across Light, Dark, OLED, Nord, etc.
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
    '--glass-border': classicHairline
      ? `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${borderAlpha.toFixed(3)})`
      : `color-mix(in srgb, ${colors['--line']} ${Math.round((0.5 + op * 0.5) * 100)}%, transparent)`,
  };
}

