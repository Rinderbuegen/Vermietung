import { createRuntimeConfig } from "../config/runtime-config.js";

function scopeBaseUrl(value) {
  const url = new URL("./", value);
  if (!/^https?:$/.test(url.protocol) || !url.hostname) throw new TypeError("Ungültiger Inhalts-Scope.");
  return url;
}

export function resolveScopeUrl(baseUrl, relativeUrl) {
  if (typeof relativeUrl !== "string" || !relativeUrl || relativeUrl.includes("\\")) {
    throw new TypeError("Ungültiger Inhaltspfad.");
  }
  const base = scopeBaseUrl(baseUrl);
  const resolved = new URL(relativeUrl, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname) || resolved.username || resolved.password) {
    throw new TypeError("Inhaltspfad verlässt den Gebäude-Scope.");
  }
  return resolved;
}

async function jsonResponse(response, message) {
  if (!response.ok) throw new Error(message);
  try {
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) throw new Error();
    return payload;
  } catch (cause) {
    throw new Error(`${message} Ungültiges JSON.`, { cause });
  }
}

export function createContentRepository(options = {}) {
  const config = createRuntimeConfig(options.config);
  const fetchImpl = options.fetch;
  const baseUrl = scopeBaseUrl(options.baseUrl);
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch ist nicht verfügbar.");

  function belongsToBuilding(item) {
    return item && typeof item === "object" && (item.buildingId === config.buildingId || item.buildingId === "*");
  }

  async function loadIndex(name, { signal } = {}) {
    const url = resolveScopeUrl(baseUrl, `assets/data/${name}.json`);
    const response = await fetchImpl(url, { method: "GET", cache: "no-cache", ...(signal ? { signal } : {}) });
    const payload = await jsonResponse(response, "Die lokalen Inhalte konnten nicht geladen werden.");
    return { ...payload, items: payload.items.filter(belongsToBuilding) };
  }

  async function getDownloads(options) {
    const payload = await loadIndex("downloads", options);
    const items = payload.items.flatMap((item) => {
      try {
        return [{ ...item, url: resolveScopeUrl(baseUrl, item.url).href }];
      } catch {
        return [];
      }
    });
    return { ...payload, items };
  }

  async function getAbout({ signal } = {}) {
    const payload = await loadIndex("about", { signal });
    const item = payload.items[0];
    if (!item) throw new Error("Kein Über-Dokument hinterlegt.");
    const url = resolveScopeUrl(baseUrl, item.url);
    const response = await fetchImpl(url, { method: "GET", cache: "no-cache", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new Error("Das Über-Dokument konnte nicht geladen werden.");
    return response.text();
  }

  return Object.freeze({
    getNews: (options) => loadIndex("news", options),
    getDownloads,
    getAbout
  });
}
