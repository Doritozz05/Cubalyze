'use client';

import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubalyze/state';
// Import from the side-effect-free "/skins" subpath: the engine's main entry
// pulls in three.js (~545 kB), which would otherwise land in the initial
// bundle just for this settings list.
import { CUBE_SKINS } from '@cubalyze/cube-3d-engine/skins';
import { ColorPicker } from '@/components/Settings/components/ColorPicker';
import { SettingRow } from '@/components/Settings/components/SettingRow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FaceLetter = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

const FACE_LABEL_KEY: Record<FaceLetter, ParseKeys<'settings'>> = {
  U: 'appearance.cubeFaceU',
  D: 'appearance.cubeFaceD',
  F: 'appearance.cubeFaceF',
  B: 'appearance.cubeFaceB',
  R: 'appearance.cubeFaceR',
  L: 'appearance.cubeFaceL',
};

const SKIN_LABEL_KEY: Record<string, ParseKeys<'settings'>> = {
  default: 'appearance.cubeSkinDefault',
  stickerless: 'appearance.cubeSkinStickerless',
  coreless: 'appearance.cubeSkinCoreless',
  translucent: 'appearance.cubeSkinTranslucent',
  custom: 'appearance.cubeSkinCustom',
};

/**
 * 3D cube visual style + custom sticker colors. Lives in Appearance (not in
 * Smart Cube) because it applies to the virtual cube too, with or without
 * paired hardware.
 */
export function CubeAppearanceSection() {
  const { t } = useTranslation('settings');
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);
  const customStickerColors = useStore(preferencesStore, (s) => s.customStickerColors);
  const setCustomStickerColors = useStore(preferencesStore, (s) => s.setCustomStickerColors);

  return (
    <div className="flex flex-col gap-5">
      {/* Skin selector — the 3D cube visual style */}
      <SettingRow
        title={t('appearance.cubeSkin')}
        description={t('appearance.cubeSkinHint')}
        control={
          <Select value={appearance3d} onValueChange={setAppearance3d}>
            <SelectTrigger className="w-40 max-lg:w-full">
              <SelectValue placeholder={t('appearance.cubeSelectSkin')} />
            </SelectTrigger>
            <SelectContent>
              {CUBE_SKINS.map((skin) => (
                <SelectItem key={skin.id} value={skin.id}>
                  {t(SKIN_LABEL_KEY[skin.id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Custom sticker colors — only visible when 'custom' skin is selected */}
      {appearance3d === 'custom' && (
        <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="mb-4">
            <h4 className="text-[0.85rem] font-medium text-ink">{t('appearance.cubeCustomStickers')}</h4>
            <p className="mt-1 text-[0.72rem] text-ink-3">
              {t('appearance.cubeCustomStickersHint')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(FACE_LABEL_KEY) as FaceLetter[]).map((face) => (
              <ColorPicker
                key={face}
                label={t(FACE_LABEL_KEY[face])}
                value={customStickerColors[face]}
                onChange={(color) => setCustomStickerColors({ [face]: color })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
