'use client';

import { Settings } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/useOnboarding';
import { SettingToggle } from '../components/SettingToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function GeneralSection() {
  // Replay is a module-level singleton action: starting it here immediately
  // remounts the tour (App closes this dialog via its tour-active effect).
  const { replay } = useOnboarding();
  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const setTimePrecision = useStore(preferencesStore, (s) => s.setTimePrecision);
  const haptics = useStore(preferencesStore, (s) => s.haptics);
  const setHaptics = useStore(preferencesStore, (s) => s.setHaptics);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Settings className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          Global application settings and interface options.
        </p>
      </div>

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium leading-5 text-ink">Time Precision</h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            Choose whether displayed times use centisecond (0.01s) or millisecond (0.001s) accuracy.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={timePrecision} onValueChange={(val) => setTimePrecision(val as 'centiseconds' | 'milliseconds')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select precision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centiseconds">Centiseconds (0.01s)</SelectItem>
              <SelectItem value="milliseconds">Milliseconds (0.001s)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SettingToggle
        title="Haptic feedback"
        description="Subtle vibration feedback on touch devices (tab switches, sheets, timer start/stop, penalties, and PB celebrations). No effect on desktop."
        checked={haptics}
        onCheckedChange={setHaptics}
      />

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium leading-5 text-ink">Onboarding tour</h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            Replay the first-run tour that walks you through the main tabs.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Button variant="outline" size="sm" onClick={replay}>
            Replay tour
          </Button>
        </div>
      </div>
    </div>
  );
}
