import * as React from "react"

/**
 * Touch-first regime (phones + small tablets). Everything below `lg` (768px)
 * gets the full touch experience (bottom tab bar, sheets, no hover-only).
 * Large tablets (iPad portrait and up, >=768px) get the desktop layout.
 *
 * Keep in sync with `--breakpoint-lg` in index.css (Tailwind `lg:`/`max-lg:`)
 * and the matchMedia gate in utils/haptics.ts.
 */
const TOUCH_BREAKPOINT = 768
/**
 * True when the viewport is in the touch regime (<768px). This is the single
 * source of truth for "should I behave like a touch app". Desktop (>=768px)
 * always returns false.
 */
export function useIsTouch() {
  // Initialise synchronously (not in an effect) so the first render already
  // matches the real viewport — otherwise touch devices would flash the
  // desktop layout (and every pill would visibly jump) for one frame.
  const [isTouch, setIsTouch] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < TOUCH_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TOUCH_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsTouch(window.innerWidth < TOUCH_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsTouch(window.innerWidth < TOUCH_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isTouch
}

/**
 * True when the device's PRIMARY pointer is a coarse one (touchscreen) —
 * regardless of viewport width.
 *
 * This is how we tell a large tablet (iPad >=768px, which gets the desktop
 * layout) apart from a real desktop: an iPad reports `(pointer: coarse)`
 * while a desktop with a mouse reports `(pointer: fine)`, so UI that needs
 * a touch affordance (e.g. click-to-stop on the timer) can switch on for
 * tablets without changing desktop behavior. OS sniffing is not used:
 * iPadOS deliberately reports "MacIntel" in its user agent.
 *
 * Initialised synchronously so the first render already matches the device.
 */
export function useIsCoarsePointer() {
  const [isCoarse, setIsCoarse] = React.useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
  )

  React.useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)")
    const onChange = () => setIsCoarse(mql.matches)
    mql.addEventListener("change", onChange)
    setIsCoarse(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isCoarse
}
