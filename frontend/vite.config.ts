import { defineConfig, type ProxyOptions } from 'vite';
import type { IncomingMessage } from 'node:http';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The backend (Express) serves its routes at the root: /status, /qr, /whitelist,
// /messages, /outbound, /health. In dev we proxy those prefixes to it so the
// browser talks to the Vite origin and there are no CORS concerns.
//
// Some prefixes (whitelist, messages, costs) collide with client-side route
// paths of the same name. Client-side nav (clicking the sidebar) never hits
// the network, so it's unaffected — but a hard refresh on e.g. /whitelist is a
// real HTTP request, and without `bypass` it'd be proxied to the backend's
// JSON API instead of falling through to the SPA shell. Full-page navigations
// send an `Accept: text/html...` header (fetch/XHR calls from api.ts don't),
// so that's the signal we use to tell the two apart.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000';
const API_PREFIXES = [
  '/status',
  '/qr',
  '/whitelist',
  '/messages',
  '/outbound',
  '/health',
  '/credentials',
  '/backfill',
  '/costs',
  '/contacts',
  '/ezy-portal',
  '/events',
];

const bypass = (req: IncomingMessage) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined);

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
      API_PREFIXES.map((p): [string, ProxyOptions] => [p, { target: API_TARGET, changeOrigin: true, bypass }]),
    ),
  },
});
