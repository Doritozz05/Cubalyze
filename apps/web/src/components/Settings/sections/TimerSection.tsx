'use client';

import { Clock } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';

/**
 * Timer settings section.
 *
 * Houses the preference that drives the start-of-solve flow:
 *   - Inspection             : run the 15s WCA inspection countdown before
 *                              the solve.
 *
 * Unified state machine in `useSolveSession` applies these preferences.
 */
export function TimerSection() {
  const inspection = useStore(preferencesStore, (s) => s.inspection);
  const setInspection = useStore(preferencesStore, (s) => s.setInspection);
  const focusMode = useStore(preferencesStore, (s) => s.focusMode);
  const setFocusMode = useStore(preferencesStore, (s) => s.setFocusMode);

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
        title="Focus Mode"
        description="Hide all UI elements (scramble, stats, sidebar) when the timer is ready and running to eliminate distractions."
        checked={focusMode}
        onCheckedChange={setFocusMode}
      />
    </div>
  );
}
