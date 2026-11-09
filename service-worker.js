const CACHE_NAME = "navai-pwa-v3";

const APP_FILES = [
  "/",
  "/manifest.webmanifest", "/static/pwa/navai-signature.svg",
  "/static/pwa/navai-icon-192.png",
  "/static/pwa/navai-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        APP_FILES.map(file => cache.add(file))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith("navai-pwa-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
        }
        return response;
      }).catch(async () => {
        return await caches.match(request) ||
               await caches.match("/") ||
               Response.error();
      })
    );
    return;
  }

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) return;

  if (/\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
        return cached || network;
      })
    );
  }
});
