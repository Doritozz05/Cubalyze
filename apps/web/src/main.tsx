import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Self-hosted fonts first so @font-face registers before any usage.
// Monos come from ./assets/fonts (full OpenType features kept); sans stay
// on Fontsource subsets (no stylistic features needed there).
import './assets/fonts/mono-fonts.css'
import '@fontsource/open-sans/latin-400.css'
import '@fontsource/open-sans/latin-500.css'
import '@fontsource/open-sans/latin-600.css'
import '@fontsource/open-sans/latin-700.css'
import '@fontsource/open-sans/latin-ext-400.css'
import '@fontsource/open-sans/latin-ext-500.css'
import '@fontsource/open-sans/latin-ext-600.css'
import '@fontsource/open-sans/latin-ext-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/inter/latin-ext-700.css'
import '@fontsource/space-grotesk/latin-ext-400.css'
import '@fontsource/space-grotesk/latin-ext-500.css'
import '@fontsource/space-grotesk/latin-ext-600.css'
import '@fontsource/space-grotesk/latin-ext-700.css'
import './index.css'
import App from './App.tsx'
import { initAppUpdate } from './boot/appUpdate'
import { appReady, appDataReady, markAppReady, markAppDataReady } from './boot/appReady'
import { installLogCapture } from './boot/logCapture'
import { AppErrorBoundary } from './boot/AppErrorBoundary'
import { LogViewer } from './components/LogViewer/LogViewer'
import { preferencesStore } from '@cubeforge/state'
import { loadCustomFonts } from '@/theme/customFonts'

// Rebuild user-uploaded @font-faces from IndexedDB (fire-and-forget;
// display:swap covers the gap until each face resolves).
void loadCustomFonts(preferencesStore.getState().customFonts)

// PWA service worker with a user-initiated update flow (registerType:
// 'prompt' in vite.config.ts). All update logic lives in boot/appUpdate.ts:
// a version.json poll (boot, every 5 min while visible, on focus/visible/
// online) detects deploys in minutes instead of the old hourly worker check,
// and every toast is version-gated against __BUILD_SHA__ so a stale waiting
// worker can never produce a phantom "reload" prompt after a hard reload.
// A freshly-deployed worker WAITS instead of reloading the page — the app
// never restarts mid-session. The worker never touches app data: only Cache
// Storage (app assets) is replaced; OPFS / IndexedDB / localStorage data is
// never touched.
initAppUpdate()

// Capture console + window errors BEFORE the app renders, so a crash at any
// point (even during boot) leaves a readable on-device trail. The viewer is
// mounted outside the error boundary on purpose: it survives render crashes.
installLogCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
    <LogViewer />
  </StrictMode>,
)

// Fade the pre-React boot loader (#root-loader-wrapper in index.html) out —
// but only once the app signals that the INITIAL view is ready (its lazy
// chunk loaded / the eager timer mounted) AND the database/session data has
// hydrated. Until then the overlay stays up, covering the Suspense fallback
// and the async DB load, so the user never sees a second loading state, a
// white flash, or dock pieces (session, solve counts) popping in after the
// fade. Two frames after ready: React has committed and painted the view
// underneath, and the crossfade (same background) hides the swap. Removing
// the element after the transition avoids a stuck overlay.
Promise.all([appReady, appDataReady]).then(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const loader = document.getElementById('root-loader-wrapper')
      if (!loader) return
      loader.classList.add('cf-loader-hidden')
      // Reduced motion disables the CSS transition, so no transitionend fires
      // — drop the overlay immediately instead of leaving it invisible for 1s.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        loader.remove()
        return
      }
      loader.addEventListener('transitionend', () => loader.remove(), { once: true })
      // Safety: never leave the overlay stuck if transitionend never fires.
      window.setTimeout(() => loader.remove(), 1000)
    })
  })
})

// Last resort: if the app never signals ready (chunk failure, runtime error,
// DB hang), release the overlay after a generous timeout so it can't block
// the UI. Deliberately long: on slow connections the view chunk can take a
// while to download, and a stuck-but-animated overlay is better than
// re-revealing a second loading spinner.
window.setTimeout(() => {
  markAppReady();
  markAppDataReady();
}, 20000)
