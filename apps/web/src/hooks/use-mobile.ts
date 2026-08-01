import * as React from "react"

const MOBILE_BREAKPOINT = 768
/**
 * Touch-first regime (mobile + tablet). Everything below `lg` (1024px) gets
 * the full touch experience (bottom tab bar, sheets, no hover-only). Desktop
 * (>=1024px) is untouched.
 */
const TOUCH_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * True when the viewport is in the touch regime (<1024px). This is the single
 * source of truth for "should I behave like a touch app" — tablets included.
 * Desktop (>=1024px) always returns false.
 */
export function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TOUCH_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsTouch(window.innerWidth < TOUCH_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsTouch(window.innerWidth < TOUCH_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isTouch
}
