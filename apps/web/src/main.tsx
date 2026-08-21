import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { appReady, appDataReady, markAppReady, markAppDataReady } from './boot/appReady'

// PWA service worker with auto-update (registerType: 'autoUpdate' in
// vite.config.ts). Registered immediately, not on window load, so the update
// check happens as early as possible. On a new deploy the browser installs the
// new service worker (skipWaiting + clientsClaim), it activates, and
// workbox-window reloads the page — users always land on the latest version
// without a hard refresh. Only Cache Storage (app assets) is replaced; OPFS /
// IndexedDB / localStorage data is never touched.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
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
