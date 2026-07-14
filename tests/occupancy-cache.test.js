import assert from "node:assert/strict";
import test from "node:test";

import {
  OCCUPANCY_CACHE_TTL_MS,
  createOccupancyCache,
  createOccupancyCacheRecord,
  legacyOccupancyCacheKey,
  occupancyCacheKey,
  parseOccupancyCacheRecord
} from "../assets/js/infrastructure/occupancy-cache.js";

const now = 1784116800000;
const range = { from: "2026-07-01", to: "2026-07-31" };
const payload = {
  schemaVersion: 2,
  loadedAt: "2026-07-15T12:00:00.000Z",
  items: [{ date: "2026-07-18", statusKey: "confirmed", publicTitle: "Öffentlich", secret: "GEHEIM" }]
};

function memoryStorage(entries = []) {
  const data = new Map(entries);
  return {
    data,
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); }
  };
}

test("verwendet v3-Schlüssel und exakt 24 Stunden TTL", () => {
  assert.equal(occupancyCacheKey("dgh_rb", range), "occupancy:v3:dgh_rb:2026-07-01:2026-07-31");
  assert.equal(legacyOccupancyCacheKey("dgh_rb", range), "occupancy:v2:dgh_rb:2026-07-01:2026-07-31");
  const record = createOccupancyCacheRecord(payload, now);
  assert.equal(JSON.stringify(record).includes("GEHEIM"), false);
  assert.equal(parseOccupancyCacheRecord(JSON.stringify(record), now + OCCUPANCY_CACHE_TTL_MS - 1).state, "fresh");
  assert.equal(parseOccupancyCacheRecord(JSON.stringify(record), now + OCCUPANCY_CACHE_TTL_MS).state, "expired");
  assert.equal(parseOccupancyCacheRecord(JSON.stringify(record), now - 1).state, "invalid");
  assert.equal(parseOccupancyCacheRecord("{", now).state, "invalid");
});

test("löscht beim v3-Wechsel alle eigenen v2- und unversionierten Einträge", () => {
  const ownV2 = legacyOccupancyCacheKey("dgh_rb", range);
  const ownFreshV2 = legacyOccupancyCacheKey("dgh_rb", { from: "2026-08-01", to: "2026-08-31" });
  const otherV2 = legacyOccupancyCacheKey("ev_gem_rb", range);
  const unversioned = "occupancy:dgh_rb:2026-07-01:2026-07-31";
  const otherUnversioned = "occupancy:ev_gem_rb:2026-07-01:2026-07-31";
  const expiredV3 = occupancyCacheKey("dgh_rb", { from: "2026-06-01", to: "2026-06-30" });
  const storage = memoryStorage([
    [ownV2, "alt"],
    [ownFreshV2, JSON.stringify(createOccupancyCacheRecord(payload, now - 1))],
    [otherV2, "fremd"],
    [unversioned, "alt"],
    [otherUnversioned, "fremd"],
    ["anderer:key", "bleibt"],
    [expiredV3, JSON.stringify(createOccupancyCacheRecord(payload, now - OCCUPANCY_CACHE_TTL_MS))]
  ]);
  const cache = createOccupancyCache({ buildingId: "dgh_rb", storageFactory: () => storage, now: () => now });
  assert.equal(cache.write(range, payload), true);
  assert.equal(storage.getItem(occupancyCacheKey("dgh_rb", range)).includes("GEHEIM"), false);
  assert.equal(cache.read(range).items[0].publicTitle, "Öffentlich");
  assert.equal(storage.data.has(ownV2), false);
  assert.equal(storage.data.has(ownFreshV2), false);
  assert.equal(storage.data.has(unversioned), false);
  assert.equal(cache.cleanup(), true);
  assert.equal(storage.data.has(expiredV3), false);
  assert.equal(storage.data.has(otherV2), true);
  assert.equal(storage.data.has(otherUnversioned), true);
  assert.equal(storage.data.has("anderer:key"), true);
  assert.equal(cache.remove(range), true);
});

test("nutzt nach Mitternacht den neuesten frischen vollständig abdeckenden v3-Record", () => {
  const requested = { from: "2026-07-16", to: "2026-07-31" };
  const oldCovering = { from: "2026-07-01", to: "2026-07-31" };
  const newestCovering = { from: "2026-07-15", to: "2026-08-31" };
  const overlapOnly = { from: "2026-07-16", to: "2026-07-20" };
  const outside = { from: "2026-08-01", to: "2026-08-31" };
  const withTitle = (title, dates = ["2026-07-16"]) => ({
    schemaVersion: 2,
    loadedAt: "2026-07-15T12:00:00.000Z",
    items: dates.map((date) => ({ date, statusKey: "confirmed", publicTitle: title, privateNote: "GEHEIM" }))
  });
  const storage = memoryStorage([
    [occupancyCacheKey("dgh_rb", oldCovering), JSON.stringify(createOccupancyCacheRecord(withTitle("älter"), now - 2_000))],
    [occupancyCacheKey("dgh_rb", newestCovering), JSON.stringify(createOccupancyCacheRecord(withTitle("neuest", ["2026-07-15", "2026-07-16"]), now - 1_000))],
    [occupancyCacheKey("dgh_rb", overlapOnly), JSON.stringify(createOccupancyCacheRecord(withTitle("nur überlappend"), now - 100))],
    [occupancyCacheKey("dgh_rb", outside), JSON.stringify(createOccupancyCacheRecord(withTitle("rangefremd", ["2026-08-01"]), now - 50))],
    [occupancyCacheKey("ev_gem_rb", requested), JSON.stringify(createOccupancyCacheRecord(withTitle("fremdes Gebäude"), now - 10))]
  ]);
  const cache = createOccupancyCache({ buildingId: "dgh_rb", storageFactory: () => storage, now: () => now });
  const cached = cache.read(requested);
  assert.deepEqual(cached.items.map((item) => [item.date, item.publicTitle]), [["2026-07-16", "neuest"]]);
  assert.equal(JSON.stringify(cached).includes("GEHEIM"), false);
});

test("verwendet keine abgelaufenen oder nicht vollständig abdeckenden Ersatz-Records", () => {
  const requested = { from: "2026-07-16", to: "2026-07-31" };
  const expiredCovering = { from: "2026-07-01", to: "2026-07-31" };
  const overlapOnly = { from: "2026-07-16", to: "2026-07-20" };
  const cachedPayload = {
    schemaVersion: 2,
    loadedAt: "2026-07-15T12:00:00.000Z",
    items: [{ date: "2026-07-16", statusKey: "confirmed", publicTitle: "nicht verwenden" }]
  };
  const expiredKey = occupancyCacheKey("dgh_rb", expiredCovering);
  const storage = memoryStorage([
    [expiredKey, JSON.stringify(createOccupancyCacheRecord(cachedPayload, now - OCCUPANCY_CACHE_TTL_MS))],
    [occupancyCacheKey("dgh_rb", overlapOnly), JSON.stringify(createOccupancyCacheRecord(cachedPayload, now - 1))]
  ]);
  const cache = createOccupancyCache({ buildingId: "dgh_rb", storageFactory: () => storage, now: () => now });
  assert.equal(cache.read(requested), null);
  assert.equal(storage.data.has(expiredKey), false);
});

test("bleibt bei gesperrtem Storage fehlertolerant", () => {
  const blocked = {
    get length() { throw new Error("gesperrt"); },
    getItem() { throw new Error("gesperrt"); },
    setItem() { throw new Error("Quota"); },
    removeItem() { throw new Error("gesperrt"); }
  };
  const cache = createOccupancyCache({ buildingId: "dgh_rb", storageFactory: () => blocked, now: () => now });
  assert.equal(cache.read(range), null);
  assert.equal(cache.write(range, payload), false);
  assert.equal(cache.remove(range), false);
  assert.equal(cache.cleanup(), false);
  const unavailable = createOccupancyCache({ buildingId: "dgh_rb", storageFactory: () => { throw new Error("SecurityError"); } });
  assert.equal(unavailable.read(range), null);
});
