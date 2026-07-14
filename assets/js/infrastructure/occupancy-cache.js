import { assertDateRange } from "../domain/date-range.js";
import { normalizeOccupancyPayload } from "../domain/occupancy.js";

export const OCCUPANCY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function occupancyCacheKey(buildingId, range) {
  return `occupancy:v3:${buildingId}:${range.from}:${range.to}`;
}

export function legacyOccupancyCacheKey(buildingId, range) {
  return `occupancy:v2:${buildingId}:${range.from}:${range.to}`;
}

export function createOccupancyCacheRecord(payload, now = Date.now()) {
  return Object.freeze({ cachedAt: now, payload: normalizeOccupancyPayload(payload) });
}

export function parseOccupancyCacheRecord(raw, now = Date.now()) {
  let record;
  try {
    record = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { state: "invalid" };
  }
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      !Number.isFinite(record.cachedAt) || record.cachedAt > now) return { state: "invalid" };
  if (now - record.cachedAt >= OCCUPANCY_CACHE_TTL_MS) return { state: "expired" };
  try {
    return { state: "fresh", payload: normalizeOccupancyPayload(record.payload) };
  } catch {
    return { state: "invalid" };
  }
}

function getStorage(storageFactory) {
  try {
    return storageFactory() || null;
  } catch {
    return null;
  }
}

function remove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function storageKeys(storage) {
  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    return keys;
  } catch {
    return null;
  }
}

function keyRange(key, prefix) {
  if (!key.startsWith(prefix)) return null;
  const match = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(key.slice(prefix.length));
  if (!match) return null;
  try {
    return assertDateRange({ from: match[1], to: match[2] });
  } catch {
    return null;
  }
}

export function createOccupancyCache({ buildingId, storageFactory = () => null, now = Date.now } = {}) {
  if (typeof buildingId !== "string" || !buildingId) throw new TypeError("Gebäude-ID für Cache fehlt.");

  function removeLegacyEntries(storage, keys) {
    const v2Prefix = `occupancy:v2:${buildingId}:`;
    const unversionedPrefix = `occupancy:${buildingId}:`;
    for (const key of keys) {
      if (key.startsWith(v2Prefix) || key.startsWith(unversionedPrefix)) remove(storage, key);
    }
  }

  function cleanup() {
    const storage = getStorage(storageFactory);
    if (!storage) return false;
    const currentPrefix = `occupancy:v3:${buildingId}:`;
    const keys = storageKeys(storage);
    if (!keys) return false;
    removeLegacyEntries(storage, keys);
    const currentTime = now();
    for (const key of keys) {
      if (!key.startsWith(currentPrefix)) continue;
      let raw;
      try {
        raw = storage.getItem(key);
      } catch {
        continue;
      }
      const parsed = parseOccupancyCacheRecord(raw, currentTime);
      if (parsed.state !== "fresh") remove(storage, key);
    }
    return true;
  }

  function read(range) {
    const storage = getStorage(storageFactory);
    if (!storage) return null;
    const keys = storageKeys(storage);
    if (keys) removeLegacyEntries(storage, keys);
    const key = occupancyCacheKey(buildingId, range);
    const currentTime = now();
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      return null;
    }
    if (raw !== null) {
      const parsed = parseOccupancyCacheRecord(raw, currentTime);
      if (parsed.state === "fresh") return normalizeOccupancyPayload(parsed.payload, range);
      remove(storage, key);
    }

    if (!keys) return null;
    const currentPrefix = `occupancy:v3:${buildingId}:`;
    let newest = null;
    for (const candidateKey of keys) {
      if (candidateKey === key) continue;
      const candidateRange = keyRange(candidateKey, currentPrefix);
      if (!candidateRange || candidateRange.from > range.from || candidateRange.to < range.to) continue;
      let candidateRaw;
      try {
        candidateRaw = storage.getItem(candidateKey);
      } catch {
        continue;
      }
      let record;
      try {
        record = typeof candidateRaw === "string" ? JSON.parse(candidateRaw) : candidateRaw;
      } catch {
        remove(storage, candidateKey);
        continue;
      }
      if (!record || typeof record !== "object" || !Number.isFinite(record.cachedAt) ||
          record.cachedAt > currentTime || currentTime - record.cachedAt >= OCCUPANCY_CACHE_TTL_MS ||
          !record.payload || typeof record.payload !== "object" || record.payload.schemaVersion !== 2 ||
          !Array.isArray(record.payload.items)) {
        remove(storage, candidateKey);
        continue;
      }
      if (!newest || record.cachedAt > newest.cachedAt) newest = record;
    }
    if (!newest) return null;
    try {
      return normalizeOccupancyPayload(newest.payload, range);
    } catch {
      return null;
    }
  }

  function write(range, payload) {
    const storage = getStorage(storageFactory);
    if (!storage) return false;
    try {
      const keys = storageKeys(storage);
      if (keys) removeLegacyEntries(storage, keys);
      const normalized = normalizeOccupancyPayload(payload, range);
      storage.setItem(occupancyCacheKey(buildingId, range), JSON.stringify({ cachedAt: now(), payload: normalized }));
      return true;
    } catch {
      return false;
    }
  }

  function discard(range) {
    const storage = getStorage(storageFactory);
    return storage ? remove(storage, occupancyCacheKey(buildingId, range)) : false;
  }

  return Object.freeze({ cleanup, read, write, remove: discard });
}
