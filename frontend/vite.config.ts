import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The backend (Express) serves its routes at the root: /status, /qr, /whitelist,
// /messages, /outbound, /health. In dev we proxy those prefixes to it so the
// browser talks to the Vite origin and there are no CORS concerns.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000';
const API_PREFIXES = ['/status', '/qr', '/whitelist', '/messages', '/outbound', '/health'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PREFIXES.map((p) => [p, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
});
