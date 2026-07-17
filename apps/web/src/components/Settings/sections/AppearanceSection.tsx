'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';

/**
 * Appearance settings section.
 *
 * Contains the "Rotate scramble with cube" toggle — controls
 * whether the scramble display adapts to the cube's orientation.
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
    <div className="flex flex-col gap-5">
      <SettingToggle
        title="Rotate scramble with cube"
        description="The scramble notation rotates to match your cube's physical orientation so it always shows what you see from your current perspective."
        checked={scrambleFollowsCube}
        onCheckedChange={setScrambleFollowsCube}
      />
    </div>
  );
}
