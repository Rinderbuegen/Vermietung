"use strict";

const assert = require("node:assert/strict");
const Core = require("../assets/js/frontend-core.js");

const now = 1784024100000;
const payload = { schemaVersion: 2, loadedAt: "2026-07-14T10:15:00.000Z", items: [{ date: "2026-07-18", publicTitle: "Titel", publicOrganizer: "Verein" }] };
assert.equal(Core.occupancyCacheKey("dgh_rb", "2026-07-01", "2026-07-31"), "occupancy:v2:dgh_rb:2026-07-01:2026-07-31");
assert.notEqual(Core.occupancyCacheKey("dgh_rb", "2026-07-01", "2026-07-31"), Core.occupancyCacheKey("ev_gem_rb", "2026-07-01", "2026-07-31"));
assert.notEqual(Core.occupancyCacheKey("dgh_rb", "2026-07-01", "2026-07-31"), Core.occupancyCacheKey("dgh_rb", "2026-08-01", "2026-08-31"));

const record = Core.createOccupancyCacheRecord(payload, now);
assert.deepEqual(Core.parseOccupancyCacheRecord(JSON.stringify(record), now + Core.OCCUPANCY_CACHE_TTL_MS - 1), { state: "fresh", payload });
assert.deepEqual(Core.parseOccupancyCacheRecord(JSON.stringify(record), now + Core.OCCUPANCY_CACHE_TTL_MS), { state: "expired" });
assert.deepEqual(Core.parseOccupancyCacheRecord(JSON.stringify(record), now - 1), { state: "invalid" });
["{", "null", "[]", JSON.stringify({ cachedAt: now, payload: {} })].forEach((value) => assert.equal(Core.parseOccupancyCacheRecord(value, now).state, "invalid"));

const sorted = Core.sortOccupancyItems([
  { date: "2026-07-20", from: "18:00", to: "20:00", id: "late" },
  { date: "2026-07-20", from: "10:00", to: "12:00", id: "first" },
  { date: "2026-07-20", from: "10:00", to: "12:00", id: "same" },
  { date: "2026-07-19", from: "20:00", to: "21:00", id: "previous" }
]);
assert.deepEqual(sorted.map((item) => item.id), ["previous", "first", "same", "late"]);
assert.equal(Core.dayStatus([{ statusKey: "confirmed", allDay: true }, { statusKey: "blocked", allDay: true }]), "blocked");
assert.equal(Core.dayStatus([{ statusKey: "confirmed", allDay: true }]), "busy");
assert.equal(Core.dayStatus([{ statusKey: "blocked", allDay: false }]), "partial");
assert.equal(Core.dayStatus([]), "free");

const calls = [];
const storage = { getItem: (key) => { calls.push(`get:${key}`); return "x"; }, setItem: (key, value) => calls.push(`set:${key}:${value}`), removeItem: (key) => calls.push(`remove:${key}`) };
assert.deepEqual(Core.readStorage(storage, "key"), { ok: true, value: "x" });
assert.equal(Core.writeStorage(storage, "key", "value"), true);
assert.equal(Core.removeStorage(storage, "key"), true);
assert.deepEqual(calls, ["get:key", "set:key:value", "remove:key"]);
const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
assert.deepEqual(Core.readStorage(blocked, "key"), { ok: false, value: null });
assert.equal(Core.writeStorage(blocked, "key", "value"), false);
assert.equal(Core.removeStorage(blocked, "key"), false);
console.log("frontend-core tests passed");
