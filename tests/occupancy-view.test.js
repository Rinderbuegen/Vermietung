import assert from "node:assert/strict";
import test from "node:test";

import { createOccupancyView } from "../assets/js/features/occupancy/view.js";

class Target extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.value = "";
    this.closestMatches = {};
  }

  closest(selector) {
    return this.closestMatches[selector] || null;
  }
}

function fixture(month) {
  const filter = new Target();
  const range = new Target();
  range.value = "current-month";
  range.dataset = { from: "2026-07-15", to: "2026-07-31" };
  const option = { textContent: "Ausgewählter Monat", hidden: true };
  range.querySelector = () => option;
  const viewSelect = new Target();
  viewSelect.value = "plan";
  const list = new Target();
  const monthButton = {
    dataset: { occupancyMonth: month, occupancyMonthLabel: month },
    closest: () => null
  };
  list.closestMatches["[data-occupancy-month]"] = monthButton;
  const nodes = { occupancyFilter: filter, occupancyRange: range, occupancyView: viewSelect, occupancyList: list };
  const document = { getElementById: (id) => nodes[id] || null };
  const occupancyView = createOccupancyView({
    document,
    setTimeout,
    clearTimeout,
    now: () => new Date(2026, 6, 15)
  });
  return { occupancyView, filter, range, option, viewSelect, list, monthButton };
}

test("vollständig vergangener Monat mutiert Auswahl und Ansicht nicht", () => {
  const current = fixture("2026-06");
  let changes = 0;
  current.occupancyView.bind({ onSelectionChange: () => { changes += 1; } });
  current.list.dispatchEvent(new Event("click"));

  assert.equal(changes, 0);
  assert.equal(current.range.value, "current-month");
  assert.deepEqual(current.range.dataset, { from: "2026-07-15", to: "2026-07-31" });
  assert.equal(current.viewSelect.value, "plan");
  assert.equal(current.option.hidden, true);
  assert.equal(current.option.textContent, "Ausgewählter Monat");
  current.occupancyView.dispose();
});

test("asynchrone und synchrone Eventhandlerfehler werden an onError gemeldet", async () => {
  const current = fixture("2026-08");
  const errors = [];
  current.occupancyView.bind({
    onRefresh: () => Promise.reject(new Error("refresh")),
    onSelectionChange: () => Promise.reject(new Error("selection")),
    onViewChange: () => { throw new Error("view"); },
    onError: (error) => errors.push(error.message)
  });

  current.filter.dispatchEvent(new Event("submit", { cancelable: true }));
  current.viewSelect.dispatchEvent(new Event("change"));
  current.list.dispatchEvent(new Event("click"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(errors.sort(), ["refresh", "selection", "view"]);
  assert.equal(current.range.value, "selected-month");
  assert.deepEqual(current.range.dataset, { from: "2026-08-01", to: "2026-08-31" });
  assert.equal(current.viewSelect.value, "table");
  current.occupancyView.dispose();
});
