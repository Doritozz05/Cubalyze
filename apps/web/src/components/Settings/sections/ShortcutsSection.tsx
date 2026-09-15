'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubalyze/state';
import { Keyboard } from 'lucide-react';

interface ShortcutDef {
  key: 'newScramble' | 'copyScramble' | 'cancelTimer' | 'startTimer';
  labelKey: ParseKeys<'settings'>;
  descriptionKey: ParseKeys<'settings'>;
}

const SHORTCUT_DEFS: ShortcutDef[] = [
  { key: 'startTimer', labelKey: 'shortcuts.startTimer', descriptionKey: 'shortcuts.startTimerDesc' },
  { key: 'newScramble', labelKey: 'shortcuts.newScramble', descriptionKey: 'shortcuts.newScrambleDesc' },
  { key: 'copyScramble', labelKey: 'shortcuts.copyScramble', descriptionKey: 'shortcuts.copyScrambleDesc' },
  { key: 'cancelTimer', labelKey: 'shortcuts.cancelTimer', descriptionKey: 'shortcuts.cancelTimerDesc' },
];

/**
 * Keyboard shortcuts settings section.
 *
 * Each shortcut is displayed as a clickable kbd element.
 * Click to enter capture mode — the next keypress becomes the new binding.
 */
export function ShortcutsSection() {
  const { t } = useTranslation('settings');

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
      // Ignore modifiers by themselves (Escape cancels capture — see below).
      if (['Alt', 'Control', 'Shift', 'Meta', 'Tab'].includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      // Store the key canonically: lowercase letters/special names, literal
      // ' ' for Space (matching useTimerKeyboard's e.key comparison).
      const capturedKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
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
          {t('shortcuts.info')}
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
              <h4 className="text-[0.85rem] font-medium text-ink">{t(def.labelKey)}</h4>
              <p className="mt-1 text-[0.72rem] text-ink-3">{t(def.descriptionKey)}</p>
            </div>
            <button
              onClick={() => handleStartCapture(def.key)}
              className="shrink-0 group/shortcut relative max-lg:flex max-lg:min-h-11 max-lg:items-center max-lg:justify-center"
            >
              {isCapturing ? (
                <kbd className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ready bg-ready/10 px-3 py-2 text-[0.78rem] font-mono font-medium text-ready animate-pulse shadow-sm shadow-ready/20">
                  {t('shortcuts.pressKey')}
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
        {t('shortcuts.footer')}
      </p>
    </div>
  );
}
