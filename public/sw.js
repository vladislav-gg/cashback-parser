const CACHE_NAME = "cashback-shell-v1";
const SHELL_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

// Network-first for page navigations (data must stay fresh), cache-first for the static shell assets.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((res) => res ?? caches.match("/")))
    );
    return;
  }

  if (SHELL_ASSETS.some((asset) => request.url.endsWith(asset))) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
  }
});
