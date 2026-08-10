import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { appReady, markAppReady } from './boot/appReady'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Fade the pre-React boot loader (#root-loader-wrapper in index.html) out —
// but only once the app signals that the INITIAL view is ready (its lazy
// chunk loaded / the eager timer mounted). Until then the overlay stays up,
// covering the Suspense fallback, so the user never sees a second loading
// state or a white flash. Two frames after ready: React has committed and
// painted the view underneath, and the crossfade (same background) hides the
// swap. Removing the element after the transition avoids a stuck overlay.
appReady.then(() => {
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

// Last resort: if the app never signals ready (chunk failure, runtime error),
// release the overlay after a generous timeout so it can't block the UI.
// Deliberately long: on slow connections the view chunk can take a while to
// download, and a stuck-but-animated overlay is better than re-revealing a
// second loading spinner.
window.setTimeout(() => markAppReady(), 20000)
