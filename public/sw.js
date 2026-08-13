/* ZYN Inner Chamber Print — lightweight PWA service worker */
const CACHE = "zyn-print-shell-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/cover.png", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan cache API polling / proxy — selalu network.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigasi: network-first, fallback cache (kiosk tetap bisa buka shell).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match("/") ),
    );
    return;
  }

  // Asset same-origin: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (!res.ok) return res;
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        });
      }),
    );
  }
});
