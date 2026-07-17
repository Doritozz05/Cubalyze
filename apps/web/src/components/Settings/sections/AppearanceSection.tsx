'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';

/**
 * Appearance settings section.
 *
 * Currently contains the "Rotate scramble with cube" toggle — controls
 * whether the scramble display follows the cube's physical orientation.
 */
export function AppearanceSection() {
  const scrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.scrambleFollowsCube,
  );
  const setScrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.setScrambleFollowsCube,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-ink">Appearance</h3>
        <p className="mt-0.5 text-[0.75rem] text-ink-3">
          Visual display and notation preferences.
        </p>
      </div>

      <SettingToggle
        title="Rotate scramble with cube"
        description="The scramble notation rotates to match your cube's physical orientation so it always shows what you see from your current perspective."
        checked={scrambleFollowsCube}
        onCheckedChange={setScrambleFollowsCube}
      />
    </div>
  );
}
