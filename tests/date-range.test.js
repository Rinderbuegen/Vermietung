import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDateRange,
  clampRange,
  monthKey,
  monthRange,
  monthsInRange,
  parseIsoDate,
  rangeFromPreset,
  todayIso,
  toIsoDate
} from "../assets/js/domain/date-range.js";

const now = new Date(2026, 6, 15, 23, 30);

test("formatiert und parst lokale ISO-Daten ohne UTC-Verschiebung", () => {
  assert.equal(toIsoDate(new Date(2026, 0, 2, 0, 15)), "2026-01-02");
  assert.equal(todayIso(now), "2026-07-15");
  assert.equal(toIsoDate(parseIsoDate("2024-02-29")), "2024-02-29");
  assert.throws(() => parseIsoDate("2023-02-29"), /Kalenderdatum/);
  assert.throws(() => parseIsoDate("15.07.2026"), /YYYY-MM-DD/);
});

test("bewahrt die bestehenden Preset-Zeiträume", () => {
  assert.deepEqual(rangeFromPreset("current-month", { now }), { from: "2026-07-15", to: "2026-07-31" });
  assert.deepEqual(rangeFromPreset("next-month", { now }), { from: "2026-07-15", to: "2026-08-31" });
  assert.deepEqual(rangeFromPreset("year", { now }), { from: "2026-07-15", to: "2026-12-31" });
  assert.deepEqual(rangeFromPreset("next-year", { now }), { from: "2027-01-01", to: "2027-12-31" });
  assert.deepEqual(rangeFromPreset("selected-month", {
    now,
    selectedRange: { from: "2026-03-01", to: "2026-03-31" }
  }), { from: "2026-03-01", to: "2026-03-31" });
  assert.deepEqual(rangeFromPreset("unbekannt", { now }), rangeFromPreset("current-month", { now }));
});

test("bildet Monate und begrenzt vergangene Monatsanfänge", () => {
  assert.equal(monthRange("2026-06", now), null);
  assert.deepEqual(monthRange("2026-07", now), { from: "2026-07-15", to: "2026-07-31" });
  assert.deepEqual(monthRange("2026-08", now), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(monthsInRange({ from: "2026-11-20", to: "2027-02-03" }).map(monthKey), [
    "2026-11", "2026-12", "2027-01", "2027-02"
  ]);
  assert.deepEqual(clampRange({ from: "2026-01-01", to: "2026-12-31" }, now), { from: "2026-07-15", to: "2026-12-31" });
  assert.equal(clampRange({ from: "2026-01-01", to: "2026-06-30" }, now), null);
  assert.throws(() => monthRange("2026-13", now), /YYYY-MM/);
  assert.throws(() => assertDateRange({ from: "2026-08-01", to: "2026-07-31" }), /endet vor/);
});
