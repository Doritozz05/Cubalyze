import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Reuse the EXISTING App component from apps/web — zero duplication.
// All UI, hooks, views, and logic live there and are shared between
// the PWA (web) and the Tauri desktop app.
import App from '../../web/src/App';

// Reuse the EXISTING global styles from the web app.
import '../../web/src/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
