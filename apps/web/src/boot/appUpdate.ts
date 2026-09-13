/**
 * Professional app-update channel (dual source of truth).
 *
 * Problem it fixes:
 *  - The service worker alone is a slow update signal: onNeedRefresh only
 *    fires after the new worker downloads + installs the whole precache, and
 *    the old code polled registration.update() once per hour with no
 *    focus/visibility/online triggers.
 *  - Phantom toast after a hard reload: registration.waiting survives the
 *    reload, so onNeedRefresh fired even though the freshly loaded bundle
 *    already WAS the new build — tapping reload then looked like a no-op.
 *
 * How it works:
 *  - scripts/gen-version-json.mjs writes public/version.json { version, sha }
 *    at build time with the same SHA baked into the bundle as __BUILD_SHA__.
 *  - This module polls /version.json (bytes, cache:no-store): every 5 min
 *    while visible + on boot, visibilitychange, focus and online (throttled).
 *    When the server SHA differs from the running bundle, it kicks
 *    registration.update() so the worker starts installing in the background
 *    AND shows the reload toast immediately — no waiting for the install.
 *  - Every toast path is version-gated: if server SHA == running SHA, no
 *    toast (and a stale waiting worker is activated silently instead).
 *  - Applying: waiting worker present → updateSW(true) (skipWaiting +
 *    reload onto the new precache); no waiting worker yet (install still in
 *    flight) → plain location.reload() since the fresh index.html + hashed
 *    chunks are already live on the server.
 *  - Fresh loads need no toast: a cold navigation fetches the latest
 *    index.html (NetworkFirst, no-cache headers), so the bundle IS new. A
 *    sessionStorage flag suppresses the re-fire on the first load after an
 *    applied update.
 *
 * The worker never touches app data — only Cache Storage is replaced.
 */

import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import i18n from '@/i18n'

const VERSION_URL = '/version.json'
const TOAST_ID = 'app-update-available'
const POLL_INTERVAL_MS = 5 * 60 * 1000
const TRIGGER_THROTTLE_MS = 30 * 1000
const SNOOZE_MS = 30 * 60 * 1000

let pendingRegistration: ServiceWorkerRegistration | undefined
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined
let toastShownForSha: string | null = null
let snoozedUntil = 0
let lastTrigger = 0
let started = false

function localSha(): string {
  return __BUILD_SHA__
}

function isDev(): boolean {
  return localSha() === 'dev' || import.meta.env.DEV
}

function appliedFlagKey(sha: string): string {
  return `cf-updated-${sha}`
}

async function fetchServerSha(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { sha?: unknown }
    return typeof data.sha === 'string' && data.sha.length > 0 ? data.sha : null
  } catch {
    return null
  }
}

function dismissStaleToast(currentServerSha: string | null): void {
  if (toastShownForSha !== null && toastShownForSha !== currentServerSha) {
    toast.dismiss(TOAST_ID)
    toastShownForSha = null
  }
}

function maybeShowToast(serverSha: string): void {
  // Already on the live build (or snoozed / already shown for this SHA) → stay quiet.
  if (serverSha === localSha()) return
  if (toastShownForSha === serverSha) return
  if (Date.now() < snoozedUntil) return
  // Just applied this exact build and reloaded onto it → suppress the re-fire.
  try {
    if (sessionStorage.getItem(appliedFlagKey(serverSha)) === '1') return
  } catch {
    /* storage unavailable — fall through to showing */
  }

  toastShownForSha = serverSha
  toast(i18n.t('common:updateAvailable'), {
    id: TOAST_ID,
    description: i18n.t('common:updateAvailableBody'),
    duration: Infinity,
    action: {
      label: i18n.t('common:reload'),
      onClick: () => void applyUpdate(),
    },
    cancel: {
      label: i18n.t('common:later'),
      onClick: () => {
        snoozedUntil = Date.now() + SNOOZE_MS
        toastShownForSha = null
      },
    },
  })
}

async function applyUpdate(): Promise<void> {
  const serverSha = await fetchServerSha()
  // Version changed under us while the toast sat open: re-gate so the button
  // never reloads onto the same build it already runs.
  if (serverSha === null || serverSha === localSha()) {
    toast.dismiss(TOAST_ID)
    toastShownForSha = null
    // A stale waiting worker may still linger — activate it silently so it
    // stops re-triggering onNeedRefresh on the next load.
    try {
      await updateSW?.(false)
    } catch {
      /* no waiting worker — nothing to do */
    }
    return
  }
  try {
    sessionStorage.setItem(appliedFlagKey(serverSha), '1')
  } catch {
    /* non-fatal */
  }
  toast.dismiss(TOAST_ID)
  if (pendingRegistration?.waiting) {
    await updateSW?.(true)
  } else {
    // Worker still installing (or SW unsupported): the new shell + hashed
    // chunks are already live, a plain reload lands on them.
    window.location.reload()
  }
}

/** One poll round: refresh the server SHA, nudge the worker, maybe toast. */
async function checkForUpdate(): Promise<void> {
  const serverSha = await fetchServerSha()
  if (serverSha === null) return
  dismissStaleToast(serverSha)
  if (serverSha === localSha()) {
    // On the live build but a stale waiting worker lingers (the hard-reload
    // phantom): activate it silently instead of toasting.
    if (pendingRegistration?.waiting) {
      try {
        await updateSW?.(false)
      } catch {
        /* ignore */
      }
    }
    return
  }
  // A newer build is live — make sure the worker is installing it, then offer
  // the reload right away without waiting for the install to finish.
  pendingRegistration?.update().catch(() => {
    /* offline or transient — the next round retries */
  })
  maybeShowToast(serverSha)
}

function triggerThrottled(): void {
  const now = Date.now()
  if (now - lastTrigger < TRIGGER_THROTTLE_MS) return
  lastTrigger = now
  void checkForUpdate()
}

/**
 * Wire the service-worker update flow + version polling. Call once from
 * main.tsx. No-ops in dev (SHA is 'dev', no version.json to compare).
 */
export function initAppUpdate(): void {
  if (started || isDev() || !('serviceWorker' in navigator)) return
  started = true

  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      pendingRegistration = registration
      // Boot check: if this load is stale (served from the runtime pages
      // cache while a deploy landed), start the worker update in the
      // background. No auto-reload — the toast asks first.
      void checkForUpdate()
    },
    // Version-gated: a waiting worker alone is NOT proof of staleness (it
    // survives hard reloads). Only toast when the server actually serves a
    // newer SHA than the running bundle.
    onNeedRefresh() {
      void (async () => {
        const serverSha = await fetchServerSha()
        if (serverSha === null || serverSha === localSha()) {
          try {
            await updateSW?.(false)
          } catch {
            /* ignore */
          }
          return
        }
        maybeShowToast(serverSha)
      })()
    },
    onOfflineReady() {
      // Shell cached for offline use — nothing to announce.
    },
  })

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  }, POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerThrottled()
  })
  window.addEventListener('focus', triggerThrottled)
  window.addEventListener('online', triggerThrottled)
}
