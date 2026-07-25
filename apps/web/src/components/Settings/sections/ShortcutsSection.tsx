'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { preferencesStore } from '@cubeforge/state';
import { Keyboard } from 'lucide-react';

interface ShortcutDef {
  key: 'newScramble' | 'copyScramble' | 'cancelTimer';
  label: string;
  description: string;
}

const SHORTCUT_DEFS: ShortcutDef[] = [
  { key: 'newScramble', label: 'New Scramble', description: 'Generate a fresh scramble' },
  { key: 'copyScramble', label: 'Copy Scramble', description: 'Copy scramble to clipboard' },
  { key: 'cancelTimer', label: 'Cancel Timer', description: 'Cancel / reset the timer' },
];

/**
 * Keyboard shortcuts settings section.
 *
 * Each shortcut is displayed as a clickable kbd element.
 * Click to enter capture mode — the next keypress becomes the new binding.
 */
export function ShortcutsSection() {
  const shortcuts = useStore(preferencesStore, (s) => s.shortcuts);
  const setShortcut = useStore(preferencesStore, (s) => s.setShortcut);

  const [capturing, setCapturing] = useState<string | null>(null);
  const captureRef = useRef<string | null>(null);
  captureRef.current = capturing;

  const handleStartCapture = useCallback((key: string) => {
    setCapturing(key);
  }, []);

  // Global key capture when in capture mode
  useEffect(() => {
    if (!capturing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifiers by themselves
      if (['Alt', 'Control', 'Shift', 'Meta', 'Tab'].includes(e.key)) return;
      // Space is reserved for the timer
      if (e.key === ' ') return;

      e.preventDefault();
      e.stopPropagation();

      const capturedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      setShortcut(capturing as ShortcutDef['key'], capturedKey);
      setCapturing(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [capturing, setShortcut]);

  // Also capture on blur / escape
  useEffect(() => {
    if (!capturing) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCapturing(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [capturing]);

  const formatKey = (key: string): string => {
    if (key === ' ' || key === 'space') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Keyboard className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] text-ink-2">
          Customize keyboard shortcuts for the timer. Click a shortcut and press the desired key to rebind.
        </p>
      </div>

      {SHORTCUT_DEFS.map((def) => {
        const isCapturing = capturing === def.key;
        return (
          <div
            key={def.key}
            className="group flex items-center justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <h4 className="text-[0.85rem] font-medium text-ink">{def.label}</h4>
              <p className="mt-1 text-[0.72rem] text-ink-3">{def.description}</p>
            </div>
            <button
              onClick={() => handleStartCapture(def.key)}
              className="shrink-0 group/shortcut relative"
            >
              {isCapturing ? (
                <kbd className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ready bg-ready/10 px-3 py-2 text-[0.78rem] font-mono font-medium text-ready animate-pulse shadow-sm shadow-ready/20">
                  Press key...
                </kbd>
              ) : (
                <kbd className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[0.78rem] font-mono font-medium text-ink shadow-sm transition-all group-hover/shortcut:border-ink/20 group-hover/shortcut:bg-surface-2 cursor-pointer">
                  {formatKey(shortcuts[def.key])}
                </kbd>
              )}
            </button>
          </div>
        );
      })}

      <p className="text-[0.65rem] text-ink-3">
        Shortcuts are disabled when an input field is focused. The spacebar is reserved for the timer and cannot be rebound.
      </p>
    </div>
  );
}
