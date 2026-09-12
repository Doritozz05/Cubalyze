import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Reuse the EXISTING App component from apps/web — zero duplication.
// All UI, hooks, views, and logic live there and are shared between
// the PWA (web) and the Tauri desktop app.
import App from '../../web/src/App';

// Self-hosted fonts (same set as apps/web): @font-face must register here
// because the desktop entry doesn't go through web's main.tsx.
// Monos come from web assets (full OpenType features kept); sans stay on
// Fontsource subsets.
import '../../web/src/assets/fonts/mono-fonts.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-500.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/open-sans/latin-ext-400.css';
import '@fontsource/open-sans/latin-ext-500.css';
import '@fontsource/open-sans/latin-ext-600.css';
import '@fontsource/open-sans/latin-ext-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-400.css';
import '@fontsource/space-grotesk/latin-ext-500.css';
import '@fontsource/space-grotesk/latin-ext-600.css';
import '@fontsource/space-grotesk/latin-ext-700.css';

// Reuse the EXISTING global styles from the web app.
import '../../web/src/index.css';

// ── Tauri auto-connect: when the Rust auto-scan finds a GAN cube,
// automatically connect without requiring the user to click "Connect".
// This is a desktop-only feature — Web Bluetooth requires user gesture.
import { listen } from '@tauri-apps/api/event';
import { globalCubeAdapter } from '../../web/src/components/Hardware/CubeConnector';
import { preferencesStore } from '@cubeforge/state';
import { smartIdsMatch } from '@cubeforge/database';
import { useCollectionStore } from '../../web/src/views/Collection/collectionStore';
import { loadCustomFonts } from '../../web/src/theme/customFonts';

// Rebuild user-uploaded @font-faces from IndexedDB (see apps/web main).
void loadCustomFonts(preferencesStore.getState().customFonts);

/**
 * Which of the cubes the auto-scan found is YOURS?
 *
 * The Locker knows: each item that is a smart cube carries its address
 * (`smart_id`). Matching through `smartIdsMatch` is deliberate — the address the
 * protocol reads and the one printed on the cube are byte-reversed, so an
 * equality check would fail on exactly the cube we are looking for.
 *
 * Returns null when nothing matches, which is not an error: a cube that has
 * never been linked still gets the old behaviour (connect to what was found).
 */
async function findOwnCubeAddress(
  cubes: { name: string; address: string }[],
): Promise<string | null> {
  try {
    // The Locker is read from SQLite asynchronously; the scan can beat it.
    // `hydrate()` is idempotent, so this is a wait, not a second load.
    await useCollectionStore.getState().hydrate();
    const stored = useCollectionStore
      .getState()
      .data.items.map((item) => item.smartId)
      .filter((id): id is string => Boolean(id));
    if (stored.length === 0) return null;

    const match = cubes.find((cube) =>
      stored.some((smartId) => smartIdsMatch(smartId, cube.address)),
    );
    return match?.address ?? null;
  } catch {
    return null;
  }
}

listen<{ cubes: { name: string; address: string }[] }>('ble:devices_found', async (event) => {
  const cubes = event.payload.cubes;
  if (cubes.length === 0) return;

  // Don't auto-connect if already connected
  if (globalCubeAdapter.isConnected) return;

  // Prefer the cube this app knows belongs to you; only fall back to "the first
  // one it saw" when nothing is linked yet. On a table with two GAN cubes, this
  // is the difference between connecting to yours and to your brother's.
  const ownAddress = await findOwnCubeAddress(cubes);
  const cube = cubes.find((candidate) => candidate.address === ownAddress) ?? cubes[0];
  console.log(
    '[AutoConnect] Cube found by auto-scan:',
    cube.name,
    cube.address,
    ownAddress ? '(linked in the Locker)' : '(nothing linked — first found)',
  );

  try {
    await globalCubeAdapter.connect(ownAddress ?? undefined);
    console.log('[AutoConnect] Connected successfully!');
  } catch (e) {
    console.warn('[AutoConnect] Auto-connect failed:', e);
    // A linked cube that is not answering must not leave the app with no cube
    // at all: retry once with whatever the scan found before giving up.
    if (ownAddress && cubes[0].address !== ownAddress) {
      try {
        await globalCubeAdapter.connect();
        return;
      } catch (fallbackError) {
        console.warn('[AutoConnect] Fallback connect failed:', fallbackError);
      }
    }
    // Don't show error toast — user can still manually connect
  }
});

// App is router-driven (deep-linkable views: /timer, /insights, …) and uses
// useLocation/useNavigate, so it MUST render inside a Router — without one
// the whole desktop app crashes on mount. BrowserRouter mirrors the web PWA
// entry (in-app SPA navigation works on the Tauri asset protocol; desktop
// users never deep-link into a path).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
