import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_OCCUPANCY_FIELDS,
  createCalendarModel,
  dayStatus,
  normalizeOccupancyPayload,
  occupancyItemsForRange,
  projectOccupancyItem,
  sortOccupancyItems,
  validateOccupancyPayload
} from "../assets/js/domain/occupancy.js";

const range = { from: "2026-07-01", to: "2026-07-31" };

test("projiziert vor Verarbeitung ausschließlich öffentliche Felder", () => {
  const projected = projectOccupancyItem({
    date: "2026-07-12", from: "10:00", to: "12:00", allDay: false,
    status: "belegt", statusKey: "confirmed", publicTitle: "Öffentlich ÄÖÜß",
    publicOrganizer: "Verein", requesterContact: "GEHEIM", internal_note: "GEHEIM"
  });
  assert.deepEqual(Object.keys(projected), PUBLIC_OCCUPANCY_FIELDS);
  assert.equal(JSON.stringify(projected).includes("GEHEIM"), false);
  assert.equal(Object.isFrozen(projected), true);
});

test("verlangt Schema 2 und normalisiert die öffentliche Antwort", () => {
  const payload = normalizeOccupancyPayload({
    schemaVersion: 2,
    loadedAt: "2026-07-15T12:00:00.000Z",
    privateEnvelopeField: "GEHEIM",
    items: [
      { date: "2026-08-01", statusKey: "confirmed", private: "GEHEIM" },
      { date: "2026-07-20", from: "18:00", to: "20:00", statusKey: "confirmed", id: "late" },
      { date: "2026-07-20", from: "10:00", to: "12:00", statusKey: "requested", id: "request" },
      { date: "2026-07-19", from: "20:00", to: "21:00", statusKey: "blocked", id: "first" }
    ]
  }, range);
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.loadedAt, "2026-07-15T12:00:00.000Z");
  assert.deepEqual(payload.items.map((item) => item.date), ["2026-07-19", "2026-07-20"]);
  assert.equal(JSON.stringify(payload).includes("GEHEIM"), false);
  assert.equal(JSON.stringify(payload).includes("requested"), false);
  assert.throws(() => validateOccupancyPayload({ schemaVersion: 1, items: [] }), /schema-Version/i);
  assert.throws(() => validateOccupancyPayload({ schemaVersion: 2, items: {} }), /Belegungsliste/);
});

test("sortiert stabil nach Datum und Uhrzeit", () => {
  const first = { date: "2026-07-20", from: "10:00", to: "12:00", publicTitle: "Erster" };
  const same = { date: "2026-07-20", from: "10:00", to: "12:00", publicTitle: "Zweiter" };
  const previous = { date: "2026-07-19", from: "20:00", to: "21:00", publicTitle: "Vorher" };
  assert.deepEqual(sortOccupancyItems([first, same, previous]).map((item) => item.publicTitle), ["Vorher", "Erster", "Zweiter"]);
  assert.deepEqual(occupancyItemsForRange([first, { ...same, date: "2026-08-01" }], range).map((item) => item.publicTitle), ["Erster"]);
});

test("berechnet Tagesstatus und Kalendermodell", () => {
  assert.equal(dayStatus([{ statusKey: "confirmed", allDay: true }]), "busy");
  assert.equal(dayStatus([{ statusKey: "blocked", allDay: true }, { statusKey: "confirmed", allDay: true }]), "blocked");
  assert.equal(dayStatus([{ statusKey: "blocked", allDay: false }]), "partial");
  assert.equal(dayStatus([{ statusKey: "requested", allDay: true }]), "free");
  assert.equal(dayStatus([]), "free");

  const model = createCalendarModel([
    { date: "2026-07-15", statusKey: "confirmed", allDay: true, private: "GEHEIM" },
    { date: "2026-07-16", statusKey: "confirmed", allDay: false }
  ], { from: "2026-07-15", to: "2026-08-02" });
  assert.deepEqual(model.map((month) => month.key), ["2026-07", "2026-08"]);
  assert.equal(model[0].days[0].inRange, false);
  assert.equal(model[0].days[14].status, "busy");
  assert.equal(model[0].days[15].status, "partial");
  assert.equal(JSON.stringify(model).includes("GEHEIM"), false);
});
