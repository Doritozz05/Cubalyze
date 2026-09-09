'use client';

import { useTranslation } from 'react-i18next';
import type { ThemePreset } from '@/theme/themePresets';

/** Four-dot preview strip shared by built-in and custom preset cards. */
export function PresetDots({ preset }: { preset: ThemePreset }) {
  const { t } = useTranslation('settings');
  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-line/60 bg-surface-2/60 p-1.5">
      <div
        role="img"
        aria-label={t('appearance.colors.canvas')}
        className="size-4.5 rounded-full border border-black/10 shadow-xs"
        style={{ backgroundColor: preset.previewColors.canvas }}
      />
      <div
        role="img"
        aria-label={t('appearance.colors.surface')}
        className="size-4.5 rounded-full border border-black/10 shadow-xs"
        style={{ backgroundColor: preset.previewColors.surface }}
      />
      <div
        role="img"
        aria-label={t('appearance.colors.ink')}
        className="size-4.5 rounded-full border border-black/10 shadow-xs"
        style={{ backgroundColor: preset.previewColors.ink }}
      />
      <div
        role="img"
        aria-label={t('appearance.colors.ready')}
        className="size-4.5 rounded-full border border-black/10 shadow-xs ml-auto"
        style={{ backgroundColor: preset.previewColors.accent }}
      />
    </div>
  );
}
