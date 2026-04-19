const CACHE_NAME = 'storecheck-v2';

self.addEventListener('install', event => {
  self.skipWaiting(); // מכריח את האפליקציה להתעדכן מיד
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // מוחק גרסאות ישנות שתוקעות את המסך
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});