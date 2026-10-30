const CACHE_NAME = "wayfinder-v1";
const TILE_CACHE = "map-tiles-v1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./offline.html"
];

/* =========================
   INSTALL – SAFE CACHING
   ========================= */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn("SW: Failed to cache", asset);
        }
      }
    })
  );
});

/* =========================
   ACTIVATE – CLEAN OLD CACHE
   ========================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* =========================
   FETCH HANDLING
   ========================= */
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  /* ---------------------------------
     1. MAP TILES – RUNTIME CACHE ONLY
     --------------------------------- */
  if (
    url.pathname.startsWith("/map/tiles") 
  ) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;

          return fetch(event.request)
            .then(response => {
              if (response && response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // ❗ NEVER return offline.html for tiles
              return cached;
            });
        })
      )
    );
    return;
  }

  /* ---------------------------------
     2. STATIC ASSETS – CACHE FIRST
     --------------------------------- */
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          return (
            cached ||
            fetch(event.request).then(response => {
              if (response && response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
          );
        })
      )
    );
    return;
  }

  /* ---------------------------------
     3. HTML NAVIGATION – OFFLINE FALLBACK
     --------------------------------- */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  /* ---------------------------------
     4. EVERYTHING ELSE – NETWORK FIRST
     --------------------------------- */
  event.respondWith(fetch(event.request));
});
