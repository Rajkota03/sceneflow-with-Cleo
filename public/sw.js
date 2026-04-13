// SceneFlow Service Worker — network-first with cache fallback
// Bump version to bust old caches on deploy
const CACHE_NAME = 'sceneflow-v2';
const SHELL_URLS = ['/', '/editor', '/character-builder'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Notify all open tabs to reload with new version
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip API calls and non-GET requests — always go to network
  if (request.method !== 'GET' || request.url.includes('/api/')) return;

  // Network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
