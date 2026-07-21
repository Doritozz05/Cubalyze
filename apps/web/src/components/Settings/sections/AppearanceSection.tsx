'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { CUBE_SKINS } from '@cubeforge/cube-3d-engine';

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
 * Contains visual preferences like the 3D cube appearance.
 * Skin options are loaded dynamically from the CUBE_SKINS registry.
 */
import { Palette } from 'lucide-react';

export function AppearanceSection() {
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);

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
    </div>
  );
}
