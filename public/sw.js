// App-shell cache tuned for Vite's content-hashed assets.
//
// HTML is served network-first so the document always matches the asset
// hashes of the live deploy (falling back to cache only when offline). Hashed
// assets are immutable, so they're served cache-first. Mixing the two — a
// cache-first HTML shell pointing at hashed chunks — is what stranded launches
// on a blank shell when the cached index drifted out of sync with the network.
const CACHE = "vroom-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("./")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Navigations (the HTML document): network-first, cache as offline fallback.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put("./", clone));
          }
          return res;
        })
        .catch(() => caches.match("./").then((hit) => hit || caches.match(e.request)))
    );
    return;
  }

  // Everything else (hashed JS/CSS, icons, manifest): cache-first, then fill
  // the cache on first fetch. Hashes make these safe to keep indefinitely.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
