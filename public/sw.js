const CACHE_NAME = 'senesmart-offline-v1';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache SeneSmart homepage');

    await cache.put('/', response.clone());

    const html = await response.text();
    const assets = [
      ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)
    ].map(match => match[1]);

    await Promise.all(assets.map(async asset => {
      try {
        const assetResponse = await fetch(asset, { cache: 'reload' });
        if (assetResponse.ok) {
          await cache.put(asset, assetResponse);
        }
      } catch (error) {
        console.warn('Could not cache asset:', asset, error);
      }
    }));

    await cache.addAll([
      '/manifest.webmanifest',
      '/senesmart-logo.png',
      '/favicon.svg',
      '/icons.svg'
    ]);

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys.filter(key => key.startsWith('senesmart-offline-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    } catch {
      return Response.error();
    }
  })());
});
