'use client';

import { Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { SettingToggle } from '../components/SettingToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function GeneralSection() {
  const theme = useStore(preferencesStore, (s) => s.theme);
  const setTheme = useStore(preferencesStore, (s) => s.setTheme);
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
        <p className="text-[0.82rem] text-ink-2">
          Global application settings and interface options.
        </p>
      </div>

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium text-ink">Theme</h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            Select your preferred interface color mode.
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="size-3.5" />
                  <span>System</span>
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="size-3.5" />
                  <span>Dark</span>
                </div>
              </SelectItem>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="size-3.5" />
                  <span>Light</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium text-ink">Time Precision</h4>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
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
    </div>
  );
}
