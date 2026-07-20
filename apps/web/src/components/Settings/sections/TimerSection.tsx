'use client';

import { Clock } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';

/**
 * Timer settings section.
 *
 * Houses the two preferences that drive the start-of-solve flow:
 *   - Scramble Verification  : require the scramble to be physically applied
 *                              on a Smart Cube before the solve can start.
 *   - Inspection             : run the 15s WCA inspection countdown before
 *                              the solve.
 *
 * Four combinations are supported by the unified state machine in
 * `useSolveSession`; both toggles default to ON to preserve current
 * behaviour.
 */
export function TimerSection() {
  const inspection = useStore(preferencesStore, (s) => s.inspection);
  const setInspection = useStore(preferencesStore, (s) => s.setInspection);

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
          <Clock className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Configure how a solve should begin. These settings also apply
          when no Smart Cube is connected.
        </p>
      </div>

      <SettingToggle
        title="Inspection"
        description="Show the 15-second WCA inspection countdown before the timer starts. Recommended for competition-style practice."
        checked={inspection}
        onCheckedChange={setInspection}
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
