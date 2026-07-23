import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Reuse the EXISTING App component from apps/web — zero duplication.
// All UI, hooks, views, and logic live there and are shared between
// the PWA (web) and the Tauri desktop app.
import App from '../../web/src/App';

// Reuse the EXISTING global styles from the web app.
import '../../web/src/index.css';

// ── Tauri auto-connect: when the Rust auto-scan finds a GAN cube,
// automatically connect without requiring the user to click "Connect".
// This is a desktop-only feature — Web Bluetooth requires user gesture.
import { listen } from '@tauri-apps/api/event';
import { globalCubeAdapter } from '../../web/src/components/Hardware/CubeConnector';

listen<{ cubes: { name: string; address: string }[] }>('ble:devices_found', async (event) => {
  const cubes = event.payload.cubes;
  if (cubes.length === 0) return;

  // Don't auto-connect if already connected
  if (globalCubeAdapter.isConnected) return;

  const cube = cubes[0];
  console.log('[AutoConnect] Cube found by auto-scan:', cube.name, cube.address);

  try {
    await globalCubeAdapter.connect();
    console.log('[AutoConnect] Connected successfully!');
  } catch (e) {
    console.warn('[AutoConnect] Auto-connect failed:', e);
    // Don't show error toast — user can still manually connect
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
