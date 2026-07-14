const CACHE_VERSION = "__CACHE_HASH__";
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_KEY = encodeURIComponent(SCOPE_URL.pathname.replace(/\/$/, "") || "/");
const CACHE_PREFIX = `vermietung-${SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const STATIC_ASSETS = __STATIC_ASSETS__;

function isCacheableResponse(response) {
  if (!response || !response.ok || response.status !== 200 || response.type === "opaque") return false;
  if (response.url && new URL(response.url).origin !== self.location.origin) return false;
  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/\bno-store\b/i.test(cacheControl) && response.headers.get("Vary") !== "*";
}

async function storeRuntime(cache, request, response) {
  if (!isCacheableResponse(response)) return;
  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("Cache konnte nicht aktualisiert werden:", request.url || request, error);
  }
}

async function precache(cache, request, response) {
  if (!isCacheableResponse(response)) {
    throw new Error(`Precache-Antwort nicht cachebar: ${request.url} (${response ? response.status : "keine Antwort"})`);
  }
  await cache.put(request, response.clone());
}

async function openRuntimeCache() {
  try {
    return await caches.open(CACHE_NAME);
  } catch (error) {
    console.warn("Runtime-Cache nicht verfügbar:", error);
    return null;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (asset) => {
      const request = new Request(new URL(asset, SCOPE_URL));
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Precache fehlgeschlagen: ${request.url} (${response.status})`);
      await precache(cache, request, response);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isBinaryAsset(request, url) {
  return request.destination === "image" || /\.(?:avif|gif|ico|jpe?g|pdf|png|svg|webp)$/i.test(url.pathname);
}

async function networkFirst(request, isNavigation) {
  try {
    const response = await fetch(request);
    const cache = await openRuntimeCache();
    if (cache) await storeRuntime(cache, request, response);
    return response;
  } catch (error) {
    const cache = await openRuntimeCache();
    if (cache) {
      try {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (isNavigation) {
          const index = await cache.match(new URL("index.html", SCOPE_URL));
          if (index) return index;
        }
      } catch (cacheError) {
        console.warn("Runtime-Cache konnte nicht gelesen werden:", cacheError);
      }
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await openRuntimeCache();
  if (cache) {
    try {
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch (error) {
      console.warn("Runtime-Cache konnte nicht gelesen werden:", error);
    }
  }
  const response = await fetch(request);
  if (cache) await storeRuntime(cache, request, response);
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return;
  const isNavigation = event.request.mode === "navigate";
  event.respondWith(isBinaryAsset(event.request, url) ? cacheFirst(event.request) : networkFirst(event.request, isNavigation));
});
