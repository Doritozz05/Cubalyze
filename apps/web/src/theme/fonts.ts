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

/** Resolve a stored id to its stack, falling back to the list default. */
export function fontStack(list: FontOption[], id: string | undefined): string {
  return list.find((f) => f.id === id)?.stack ?? list[0].stack;
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
