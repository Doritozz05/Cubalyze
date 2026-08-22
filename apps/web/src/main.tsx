import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { registerSW } from 'virtual:pwa-register'
import { appReady, appDataReady, markAppReady, markAppDataReady } from './boot/appReady'
import { installLogCapture } from './boot/logCapture'
import { AppErrorBoundary } from './boot/AppErrorBoundary'
import { LogViewer } from './components/LogViewer/LogViewer'

// PWA service worker with a user-initiated update flow (registerType:
// 'prompt' in vite.config.ts). A freshly-deployed worker WAITS instead of
// reloading the page — the app never restarts mid-session (no more mid-solve
// resets). If an update is found (at load, or by the hourly check below), a
// toast offers a reload and the user taps it when convenient; the page is
// only ever reloaded by explicit consent. The worker never touches app data:
// only Cache Storage (app assets) is replaced; OPFS / IndexedDB / localStorage
// data is never touched.
let pendingRegistration: ServiceWorkerRegistration | undefined

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    pendingRegistration = registration
  },
  onNeedRefresh() {
    toast(i18n.t('common:updateAvailable'), {
      description: i18n.t('common:updateAvailableBody'),
      action: {
        label: i18n.t('common:reload'),
        onClick: () => void updateSW(true),
      },
      duration: 30000,
    })
  },
  onOfflineReady() {
    // The app shell is cached for offline use — nothing to announce (a toast
    // here would be noise; no user action is required).
  },
})

// Pick up deploys that happen during long sessions: check hourly. The check
// only downloads the new worker; applying it (and reloading) always waits for
// the user's tap on the toast.
if ('serviceWorker' in navigator) {
  window.setInterval(() => {
    pendingRegistration?.update().catch(() => {
      /* offline or transient — the next check retries */
    })
  }, 60 * 60 * 1000)
}

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
