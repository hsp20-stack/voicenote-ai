// VoiceNote AI - Service Worker (Network First)
const CACHE_NAME = 'voicenote-ai-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map(key => caches.delete(key)) // Limpia todas las cachés anteriores
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Intenta obtener siempre la versión más reciente de la red
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
