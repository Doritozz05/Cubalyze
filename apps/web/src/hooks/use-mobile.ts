import * as React from "react"

/**
 * Touch-first regime (mobile + tablet). Everything below `lg` (1024px) gets
 * the full touch experience (bottom tab bar, sheets, no hover-only). Desktop
 * (>=1024px) is untouched.
 */
const TOUCH_BREAKPOINT = 1024
/**
 * True when the viewport is in the touch regime (<1024px). This is the single
 * source of truth for "should I behave like a touch app" — tablets included.
 * Desktop (>=1024px) always returns false.
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
