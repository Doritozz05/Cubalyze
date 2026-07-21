'use client';

import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';

import { Shuffle } from 'lucide-react';

export function ScrambleSection() {
  const scrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.scrambleFollowsCube,
  );
  const setScrambleFollowsCube = useStore(
    preferencesStore,
    (s) => s.setScrambleFollowsCube,
  );

  const scrambleVerification = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const setScrambleVerification = useStore(
    preferencesStore,
    (s) => s.setScrambleVerification,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Shuffle className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Configure how scramble sequences are generated, verified, and aligned with your cube.
        </p>
      </div>
      <SettingToggle
        title="Rotate scramble with cube"
        description="The scramble notation rotates to match your cube's physical orientation so it always shows what you see from your current perspective."
        checked={scrambleFollowsCube}
        onCheckedChange={setScrambleFollowsCube}
      />

      <SettingToggle
        title="Scramble Verification"
        description="When a Smart Cube is paired, require the scramble sequence to be physically applied before the solve can start. Prevents accidental starts while mixing."
        checked={scrambleVerification}
        onCheckedChange={setScrambleVerification}
      />
    </div>
  );
}
