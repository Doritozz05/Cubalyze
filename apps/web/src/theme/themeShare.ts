/**
 * Theme share files (export / import).
 *
 * A share file captures the *current look* without binaries: preset
 * reference (built-in id) or embedded custom definition, live color
 * overrides, chosen fonts and liquid-glass options. Background media and
 * uploaded font blobs are deliberately excluded — they don't travel.
 */
export const THEME_SHARE_VERSION = 1;

export interface SharedThemeOptions {
  fontSans: string;
  fontMono: string;
  zeroStyle: 'dotted' | 'slashed';
  liquidGlass: boolean;
  liquidGlassOpacity: number;
  liquidGlassBlur: number | null;
}

export type SharedThemePreset =
  | { kind: 'builtin'; id: string }
  | { kind: 'custom'; name: string; base: 'light' | 'dark'; colors: Record<string, string> };

export interface SharedThemeFile {
  version: 1;
  app: 'cubeforge';
  exportedAt: number;
  preset: SharedThemePreset;
  overrides: Record<string, string> | null;
  options: SharedThemeOptions;
}

const MAX_COLOR_TOKENS = 80;

function isColorMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_COLOR_TOKENS) return false;
  return entries.every(
    ([key, val]) => key.startsWith('--') && typeof val === 'string' && val.length <= 64,
  );
}

function isOptions(value: unknown): value is SharedThemeOptions {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.fontSans === 'string' &&
    typeof o.fontMono === 'string' &&
    (o.zeroStyle === 'dotted' || o.zeroStyle === 'slashed') &&
    typeof o.liquidGlass === 'boolean' &&
    typeof o.liquidGlassOpacity === 'number' &&
    Number.isFinite(o.liquidGlassOpacity) &&
    (o.liquidGlassBlur === null ||
      (typeof o.liquidGlassBlur === 'number' && Number.isFinite(o.liquidGlassBlur)))
  );
}

/** Strict validation — returns null for anything that isn't our schema. */
export function parseSharedTheme(raw: unknown): SharedThemeFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (f.version !== THEME_SHARE_VERSION || f.app !== 'cubeforge') return null;
  if (typeof f.exportedAt !== 'number') return null;

  const p = f.preset;
  if (!p || typeof p !== 'object') return null;
  const preset = p as Record<string, unknown>;
  let normalized: SharedThemePreset;
  if (preset.kind === 'builtin') {
    if (typeof preset.id !== 'string' || !preset.id) return null;
    normalized = { kind: 'builtin', id: preset.id };
  } else if (preset.kind === 'custom') {
    if (
      typeof preset.name !== 'string' ||
      !preset.name.trim() ||
      (preset.base !== 'light' && preset.base !== 'dark') ||
      !isColorMap(preset.colors)
    ) {
      return null;
    }
    normalized = {
      kind: 'custom',
      name: preset.name.trim().slice(0, 40),
      base: preset.base,
      colors: preset.colors,
    };
  } else {
    return null;
  }

  if (f.overrides !== null && f.overrides !== undefined && !isColorMap(f.overrides)) return null;
  if (!isOptions(f.options)) return null;

  return {
    version: 1,
    app: 'cubeforge',
    exportedAt: f.exportedAt,
    preset: normalized,
    overrides: (f.overrides as Record<string, string> | null) ?? null,
    options: f.options,
  };
}

/** Safe filename slug from a theme label. */
export function themeFileSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'theme';
}
