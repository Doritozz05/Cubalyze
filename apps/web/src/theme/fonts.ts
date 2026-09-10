import cascadiaWoff2 from '@/assets/fonts/cascadia-code-latin.woff2';
import jetbrainsWoff2 from '@/assets/fonts/jetbrains-mono-latin.woff2';
import ibmPlexWoff2 from '@/assets/fonts/ibm-plex-mono-400-latin.woff2';
import openSansWoff2 from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff2';
import interWoff2 from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import spaceGroteskWoff2 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2';
import type { CustomFontMeta } from '@cubeforge/state';
import { getCustomFontBlobUrl } from './customFonts';

/**
 * Theme Studio typography registry.
 *
 * Every family here is self-hosted (Fontsource, latin subsets imported in
 * `main.tsx`), so each option renders identically on every device. The
 * `system` option restores the legacy pure-system stacks. Labels are font
 * names on purpose — they need no translation.
 */

export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

const SYSTEM_SANS =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const SYSTEM_MONO =
  "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace";

export const SANS_FONTS: FontOption[] = [
  {
    id: 'open-sans',
    label: 'Open Sans',
    stack: `'Open Sans', ${SYSTEM_SANS}`,
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: `'Inter', ${SYSTEM_SANS}`,
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: `'Space Grotesk', ${SYSTEM_SANS}`,
  },
  { id: 'system', label: 'System', stack: SYSTEM_SANS },
];

export const MONO_FONTS: FontOption[] = [
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    stack: `'Cascadia Code', ${SYSTEM_MONO}`,
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: `'JetBrains Mono', ${SYSTEM_MONO}`,
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    stack: `'IBM Plex Mono', ${SYSTEM_MONO}`,
  },
  { id: 'system', label: 'System', stack: SYSTEM_MONO },
];

export const ALL_FONTS: FontOption[] = [
  ...SANS_FONTS.filter((f) => f.id !== 'system'),
  ...MONO_FONTS.filter((f) => f.id !== 'system'),
  { id: 'system', label: 'System', stack: SYSTEM_SANS },
];

/** Resolve a stored id to its stack, falling back to the list default. */
export function fontStack(list: FontOption[], id: string | undefined): string {
  return ALL_FONTS.find((f) => f.id === id)?.stack ?? list.find((f) => f.id === id)?.stack ?? list[0].stack;
}

/**
 * OpenType feature tag producing a slashed zero for the given mono id.
 * Most families (Cascadia, JetBrains, …) answer to `zero`; IBM Plex Mono
 * needs `ss03` instead (per IBM). Unknown/custom ids default to `zero`,
 * which fonts without the feature safely ignore.
 */
export function slashedZeroFeature(id: string | undefined): string {
  return id === 'ibm-plex-mono' ? '"ss03" 1' : '"zero" 1';
}

/**
 * Whether the given digit-font id is known to ship a slashed-zero glyph.
 * Cascadia, JetBrains Mono (`zero`), IBM Plex Mono (`ss03`) and
 * Space Grotesk (`zero`) all do. Open Sans and Inter have no slashed-zero
 * feature, so the toggle would be a no-op for them. Unknown ids (system
 * stack, user uploads) default to true — the feature is safely ignored
 * when absent, and hiding the control could remove a working option.
 */
export function supportsSlashedZero(id: string | undefined): boolean {
  return id !== 'open-sans' && id !== 'inter';
}

/**
 * Universal Unicode range for digits, numeric separators, and cubing/math symbols:
 * - 0-9: U+0030-0039
 * - Decimal/time delimiters (. , :): U+002E, U+002C, U+003A
 * - Math & penalties (+ - ±): U+002B, U+002D, U+00B1
 * - Cube notation turns (' ′ ² ³): U+0027, U+2032, U+00B2, U+00B3
 * - Math operators (/ % − –): U+002F, U+0025, U+2212, U+2013
 */
export const DIGIT_UNICODE_RANGE =
  'U+0030-0039, U+002E, U+003A, U+002C, U+002B, U+002D, U+00B1, U+0027, U+2032, U+00B2, U+00B3, U+002F, U+0025, U+2212, U+2013';

/**
 * Resolves the CSS `src` descriptor for the given font id (built-in or user blob).
 */
export function resolveDigitFontSrc(id: string | undefined, customs: CustomFontMeta[]): string {
  const custom = customs.find((f) => f.id === id);
  if (custom) {
    const blobUrl = getCustomFontBlobUrl(custom.id);
    if (blobUrl) return `url("${blobUrl}")`;
  }
  if (id === 'cascadia-code') return `url("${cascadiaWoff2}") format("woff2")`;
  if (id === 'jetbrains-mono') return `url("${jetbrainsWoff2}") format("woff2")`;
  if (id === 'ibm-plex-mono') return `url("${ibmPlexWoff2}") format("woff2")`;
  if (id === 'open-sans') return `url("${openSansWoff2}") format("woff2")`;
  if (id === 'inter') return `url("${interWoff2}") format("woff2")`;
  if (id === 'space-grotesk') return `url("${spaceGroteskWoff2}") format("woff2")`;
  return `local('Cascadia Code'), local('Source Code Pro'), local('Menlo'), local('Consolas'), monospace`;
}

