const CONFIGURATION_MESSAGE = "Bitte Gebäude-Konfiguration prüfen.";
const REMOTE_API_CONFIGURATION_MESSAGE = "Bitte Apps-Script-URL in config/config.js eintragen.";

function copyAndFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) throw new TypeError("Die Laufzeitkonfiguration darf keine Zyklen enthalten.");
  seen.add(value);

  const copy = Array.isArray(value) ? [] : {};
  for (const [key, child] of Object.entries(value)) copy[key] = copyAndFreeze(child, seen);
  seen.delete(value);
  return Object.freeze(copy);
}

export function requireApiBaseUrl(config) {
  const value = config && config.apiBaseUrl;
  if (typeof value !== "string" || !value.trim() || value.includes("DEPLOYMENT_ID")) {
    throw new TypeError(REMOTE_API_CONFIGURATION_MESSAGE);
  }
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    throw new TypeError(REMOTE_API_CONFIGURATION_MESSAGE);
  }
}

export function createRuntimeConfig(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError(CONFIGURATION_MESSAGE);
  }
  if (typeof source.buildingId !== "string" || !source.buildingId.trim()) {
    throw new TypeError(CONFIGURATION_MESSAGE);
  }
  return copyAndFreeze(source);
}

export function getRuntimeConfig(root = globalThis) {
  return createRuntimeConfig(root.APP_CONFIG);
}

export function serviceWorkerRegistrationEnabled(root = globalThis) {
  const source = root && root.APP_CONFIG;
  return Boolean(source && typeof source === "object" && !Array.isArray(source) && source.registerServiceWorker === true);
}

export { CONFIGURATION_MESSAGE, REMOTE_API_CONFIGURATION_MESSAGE };
