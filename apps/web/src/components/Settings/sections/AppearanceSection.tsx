'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { CUBE_SKINS } from '@cubeforge/cube-3d-engine';
import { ColorPicker } from '@/components/Settings/components/ColorPicker';
import { Palette } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Appearance settings section.
 *
 * Contains visual preferences like the 3D cube appearance and custom sticker colors.
 * When the 'custom' skin is selected, per-face color pickers appear below.
 */
const FACE_LABELS: Record<string, string> = {
  U: 'Up (White)',
  D: 'Down (Yellow)',
  F: 'Front (Green)',
  B: 'Back (Blue)',
  R: 'Right (Red)',
  L: 'Left (Orange)',
};

export function AppearanceSection() {
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);
  const customStickerColors = useStore(preferencesStore, (s) => s.customStickerColors);
  const setCustomStickerColors = useStore(preferencesStore, (s) => s.setCustomStickerColors);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Palette className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Customize the visual style and rendering preferences for the 3D cube representation.
        </p>
      </div>

      {/* Skin selector */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium text-ink">3D Appearance</h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            Choose the visual style for the 3D cube representation.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={appearance3d} onValueChange={setAppearance3d}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select appearance" />
            </SelectTrigger>
            <SelectContent>
              {CUBE_SKINS.map((skin) => (
                <SelectItem key={skin.id} value={skin.id}>
                  {skin.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom sticker colors — only visible when 'custom' skin is selected */}
      {appearance3d === 'custom' && (
        <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
          <div className="mb-4">
            <h4 className="text-[0.85rem] font-medium text-ink">Custom Sticker Colors</h4>
            <p className="mt-1 text-[0.72rem] text-ink-3">
              Pick a color for each face. Changes apply in real-time to the 3D cube.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(FACE_LABELS) as Array<'U' | 'D' | 'F' | 'B' | 'R' | 'L'>).map((face) => (
              <ColorPicker
                key={face}
                label={FACE_LABELS[face]}
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
