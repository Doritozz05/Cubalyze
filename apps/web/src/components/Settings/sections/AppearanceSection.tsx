'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';

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
 */
export function AppearanceSection() {
  const appearance3d = useStore(preferencesStore, (s) => s.appearance3d);
  const setAppearance3d = useStore(preferencesStore, (s) => s.setAppearance3d);

  return (
    <div className="flex flex-col gap-5">
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
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="stickerless">Stickerless</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
