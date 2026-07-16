// Minimal service worker — exists to make the dashboard installable as a PWA
// (Add to Home Screen / standalone window). Deliberately NO caching: the app
// is live data over SSE + React Query, and a stale-shell cache here has burned
// more time than it could ever save. Every request passes straight through to
// the network (no respondWith → browser default handling).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
