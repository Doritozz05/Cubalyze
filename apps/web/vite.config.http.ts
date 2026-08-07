import { defineConfig } from 'vite'
import base from './vite.config'

// HTTP-only variant for automated browser verification — Kaspersky intercepts
// the basicSsl self-signed cert on localhost, so we drop SSL and HMR wss.
// TEMPORARY: delete after the verification run.
export default defineConfig(({ mode }) => {
  const cfg = base({ mode }) as any
  return {
    ...cfg,
    server: {
      ...cfg.server,
      https: false,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5175,
      },
    },
  }
})
