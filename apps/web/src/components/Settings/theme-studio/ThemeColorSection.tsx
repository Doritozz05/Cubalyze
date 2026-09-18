'use client';

import { useTranslation } from 'react-i18next';
import { ColorPicker } from '@/components/Settings/components/ColorPicker';
import { contrastRatio, AA_NORMAL_TEXT_RATIO } from '@/components/Settings/components/colorUtils';
import { type ThemeColors, type ThemeTokenKey } from '@/theme/themePresets';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ThemeColorSectionProps {
  currentColors: ThemeColors;
  defaultColors: ThemeColors;
  onColorChange: (token: ThemeTokenKey, color: string) => void;
  onResetColors: () => void;
  onResetToken: (token: ThemeTokenKey) => void;
  hasCustomOverrides: boolean;
}

interface ColorGroupItem {
  token: ThemeTokenKey;
  labelKey: string;
}

const SURFACE_GROUP: ColorGroupItem[] = [
  { token: '--canvas', labelKey: 'appearance.colors.canvas' },
  { token: '--surface', labelKey: 'appearance.colors.surface' },
  { token: '--surface-2', labelKey: 'appearance.colors.surface2' },
  { token: '--line', labelKey: 'appearance.colors.line' },
  { token: '--line-2', labelKey: 'appearance.colors.line2' },
];

const TEXT_GROUP: ColorGroupItem[] = [
  { token: '--ink', labelKey: 'appearance.colors.ink' },
  { token: '--ink-2', labelKey: 'appearance.colors.ink2' },
  { token: '--ink-3', labelKey: 'appearance.colors.ink3' },
];

const ACCENT_GROUP: ColorGroupItem[] = [
  { token: '--ready', labelKey: 'appearance.colors.ready' },
  { token: '--hold', labelKey: 'appearance.colors.hold' },
  { token: '--dnf', labelKey: 'appearance.colors.dnf' },
  { token: '--plus2', labelKey: 'appearance.colors.plus2' },
  { token: '--caution', labelKey: 'appearance.colors.caution' },
];

export function ThemeColorSection({
  currentColors,
  defaultColors,
  onColorChange,
  onResetColors,
  onResetToken,
  hasCustomOverrides,
}: ThemeColorSectionProps) {
  const { t } = useTranslation('settings');

  // Guardrail, never a block: custom themes are the user's own choice, so a
  // low canvas/ink ratio only warns (WCAG AA normal text = 4.5:1). Built-in
  // presets all pass; only custom overrides can trip this.
  const textRatio =
    hasCustomOverrides
      ? contrastRatio(currentColors['--canvas'] ?? '', currentColors['--ink'] ?? '')
      : null;
  const lowContrast = textRatio !== null && textRatio < AA_NORMAL_TEXT_RATIO;

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Reset Action */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-ink">
            {t('appearance.colors.title')}
          </h4>
          <p className="mt-0.5 text-xs text-ink-3">
            {t('appearance.colors.subtitle')}
          </p>
        </div>
        {hasCustomOverrides && (
          <button
            type="button"
            onClick={onResetColors}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface hover:text-dnf"
          >
            <RotateCcw className="size-3.5" />
            <span>{t('appearance.colors.reset')}</span>
          </button>
        )}
      </div>

      {/* 1. Surfaces */}
      {lowContrast && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-caution/30 bg-caution/10 p-3 text-[0.72rem] leading-relaxed text-ink-2"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-caution" aria-hidden="true" />
          {t('appearance.colors.lowContrastWarning', { ratio: textRatio!.toFixed(1) })}
        </p>
      )}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
          {t('appearance.colors.groupSurfaces')}
        </h5>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SURFACE_GROUP.map(({ token, labelKey }) => (
            <ColorPicker
              key={token}
              label={t(labelKey, token)}
              value={currentColors[token]}
              defaultColor={defaultColors[token]}
              onResetToDefault={() => onResetToken(token)}
              onChange={(color) => onColorChange(token, color)}
            />
          ))}
        </div>
      </div>

      {/* 2. Typography / Inks */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
          {t('appearance.colors.groupTypography')}
        </h5>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {TEXT_GROUP.map(({ token, labelKey }) => (
            <ColorPicker
              key={token}
              label={t(labelKey, token)}
              value={currentColors[token]}
              defaultColor={defaultColors[token]}
              onResetToDefault={() => onResetToken(token)}
              onChange={(color) => onColorChange(token, color)}
            />
          ))}
        </div>
      </div>

      {/* 3. Timer & Accents */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
          {t('appearance.colors.groupAccents')}
        </h5>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ACCENT_GROUP.map(({ token, labelKey }) => (
            <ColorPicker
              key={token}
              label={t(labelKey, token)}
              value={currentColors[token]}
              defaultColor={defaultColors[token]}
              onResetToDefault={() => onResetToken(token)}
              onChange={(color) => onColorChange(token, color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
