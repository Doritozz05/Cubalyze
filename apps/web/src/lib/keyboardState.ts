/**
 * Module-level keyboard gate read at EVENT time by the global timer and
 * shortcut handlers (useTimerKeyboard / useShortcuts) — no re-renders.
 *
 * While a modal owns the keyboard (e.g. the Settings dialog, including the
 * Shortcuts key-capture mode), the timer must NOT react to key presses:
 * otherwise pressing Space inside Settings to rebind a shortcut would also
 * arm/start the timer, and N/C/Esc would trigger scramble actions.
 */
export const keyboardState = {
  /** True while the Settings dialog is open. */
  settingsOpen: false,
};
