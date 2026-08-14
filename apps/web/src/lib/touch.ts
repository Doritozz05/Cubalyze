/**
 * Full-bleed bottom-sheet treatment for dialogs below 768px (touch regime).
 *
 * Every class is max-lg-prefixed, so desktop (>=768px) is untouched. The
 * trailing-bang `!` on max-w-none is REQUIRED: the base max-w-[calc(100%-2rem)]
 * / sm:max-w-* caps would otherwise limit the width of the left-anchored sheet
 * (Tailwind emits max-lg before sm in the max-w group, so a plain
 * max-lg:max-w-none loses to sm:max-w-[900px] on tablets — verified in the
 * built CSS as `.max-lg\:max-w-none\!{max-width:none!important}`).
 */
export const TOUCH_FULL_BLEED =
  "max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:translate-x-0 max-lg:translate-y-0 max-lg:max-w-none! max-lg:rounded-b-none max-lg:rounded-t-2xl";
