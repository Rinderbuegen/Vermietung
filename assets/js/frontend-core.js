(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrontendCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const OCCUPANCY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  function occupancyCacheKey(buildingId, from, to) {
    return `occupancy:v2:${buildingId}:${from}:${to}`;
  }

  function createOccupancyCacheRecord(payload, now) {
    return { cachedAt: now === undefined ? Date.now() : now, payload };
  }

  function parseOccupancyCacheRecord(raw, now) {
    let record;
    try {
      record = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (error) {
      return { state: "invalid" };
    }
    const currentTime = now === undefined ? Date.now() : now;
    if (!record || typeof record !== "object" || !Number.isFinite(record.cachedAt) || record.cachedAt > currentTime || !record.payload || typeof record.payload !== "object" || !Array.isArray(record.payload.items)) {
      return { state: "invalid" };
    }
    if (currentTime - record.cachedAt >= OCCUPANCY_CACHE_TTL_MS) return { state: "expired" };
    return { state: "fresh", payload: record.payload };
  }

  function sortOccupancyItems(items) {
    return (items || []).map((item, index) => ({ item, index })).sort((left, right) =>
      String(left.item.date || "").localeCompare(String(right.item.date || "")) ||
      String(left.item.from || "").localeCompare(String(right.item.from || "")) ||
      String(left.item.to || "").localeCompare(String(right.item.to || "")) ||
      left.index - right.index
    ).map(({ item }) => item);
  }

  function dayStatus(items) {
    const entries = items || [];
    if (entries.some((item) => item && item.statusKey === "blocked" && item.allDay)) return "blocked";
    if (entries.some((item) => item && item.statusKey === "confirmed" && item.allDay)) return "busy";
    return entries.length ? "partial" : "free";
  }

  function readStorage(storage, key) {
    try { return { ok: true, value: storage.getItem(key) }; } catch (error) { return { ok: false, value: null }; }
  }

  function writeStorage(storage, key, value) {
    try { storage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function removeStorage(storage, key) {
    try { storage.removeItem(key); return true; } catch (error) { return false; }
  }

  return { OCCUPANCY_CACHE_TTL_MS, occupancyCacheKey, createOccupancyCacheRecord, parseOccupancyCacheRecord, sortOccupancyItems, dayStatus, readStorage, writeStorage, removeStorage };
});
