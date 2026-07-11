const CACHE_VERSION = "v17";
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_KEY = encodeURIComponent(SCOPE_URL.pathname.replace(/\/$/, "") || "/");
const CACHE_PREFIX = `vermietung-${SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const STATIC_ASSETS = [
  "./index.html",
  "./manifest.webmanifest",
  "./config/config.js",
  "./config/DGH/config.js",
  "./config/Gemeindehaus/config.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/css/app.css",
  "./assets/js/api.js",
  "./assets/js/ui.js",
  "./assets/js/app.js",
  "./assets/data/news.json",
  "./assets/data/downloads.json",
  "./assets/data/about.json",
  "./about/dgh_rb/about.md",
  "./about/ev_gem_rb/about.md"
];

function isCacheableResponse(response) {
  if (!response || !response.ok || response.status !== 200 || response.type === "opaque") {
    return false;
  }
  if (response.url && new URL(response.url).origin !== self.location.origin) {
    return false;
  }
  const cacheControl = response.headers.get("Cache-Control") || "";
  return !/\bno-store\b/i.test(cacheControl) && response.headers.get("Vary") !== "*";
}

async function store(cache, request, response) {
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone());
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (asset) => {
      const request = new Request(new URL(asset, SCOPE_URL));
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`Precache fehlgeschlagen: ${request.url} (${response.status})`);
      }
      await store(cache, request, response);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isBinaryAsset(request, url) {
  return request.destination === "image" || /\.(?:avif|gif|ico|jpe?g|pdf|png|svg|webp)$/i.test(url.pathname);
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    await store(cache, request, response);
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    if (isNavigation) {
      const index = await cache.match(new URL("index.html", SCOPE_URL));
      if (index) {
        return index;
      }
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  await store(cache, request, response);
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET"
      || url.origin !== self.location.origin
      || !url.pathname.startsWith(SCOPE_URL.pathname)) {
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  event.respondWith(isBinaryAsset(event.request, url)
    ? cacheFirst(event.request)
    : networkFirst(event.request, isNavigation));
});
