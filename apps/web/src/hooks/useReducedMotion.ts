import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * True when the user prefers reduced motion. Mirrors the precedent set in
 * `PbCelebrationBanner` (direct `matchMedia`) but tracks live changes so
 * framer-motion / CSS animation gates respond to a preference change mid
 * session. Defaults to `null` until mounted so SSR and the first paint are
 * deterministic.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return reduced ?? false;
}