import { assertDateRange, monthKey, monthsInRange, toIsoDate } from "./date-range.js";

export const PUBLIC_OCCUPANCY_FIELDS = Object.freeze([
  "date", "from", "to", "allDay", "status", "statusKey", "publicTitle", "publicOrganizer"
]);

function text(value) {
  return typeof value === "string" ? value : "";
}

export function projectOccupancyItem(source) {
  const item = source && typeof source === "object" ? source : {};
  return Object.freeze({
    date: text(item.date),
    from: text(item.from),
    to: text(item.to),
    allDay: item.allDay === true,
    status: text(item.status),
    statusKey: text(item.statusKey),
    publicTitle: text(item.publicTitle),
    publicOrganizer: text(item.publicOrganizer)
  });
}

function projectedItems(items) {
  return (Array.isArray(items) ? items : []).map(projectOccupancyItem);
}

export function validateOccupancyPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Ungültige Belegungsantwort.");
  }
  if (payload.schemaVersion !== 2) throw new TypeError("Nicht unterstützte Belegungsschema-Version.");
  if (!Array.isArray(payload.items)) throw new TypeError("Ungültige Belegungsliste.");
  return payload;
}

export function sortOccupancyItems(items) {
  return projectedItems(items).map((item, index) => ({ item, index })).sort((left, right) =>
    left.item.date.localeCompare(right.item.date) ||
    left.item.from.localeCompare(right.item.from) ||
    left.item.to.localeCompare(right.item.to) ||
    left.index - right.index
  ).map(({ item }) => item);
}

export function occupancyItemsForRange(items, range) {
  const checked = range ? assertDateRange(range) : null;
  const filtered = projectedItems(items).filter((item) =>
    item.statusKey !== "requested" && (!checked || (item.date >= checked.from && item.date <= checked.to))
  );
  return sortOccupancyItems(filtered);
}

export function normalizeOccupancyPayload(payload, range, now = new Date()) {
  const valid = validateOccupancyPayload(payload);
  const loadedAt = typeof valid.loadedAt === "string" && valid.loadedAt ? valid.loadedAt : now.toISOString();
  return Object.freeze({
    schemaVersion: 2,
    loadedAt,
    items: Object.freeze(occupancyItemsForRange(valid.items, range))
  });
}

export function dayStatus(items) {
  const entries = projectedItems(items).filter((item) => item.statusKey !== "requested");
  if (entries.some((item) => item.statusKey === "blocked" && item.allDay)) return "blocked";
  if (entries.some((item) => item.statusKey === "confirmed" && item.allDay)) return "busy";
  return entries.length ? "partial" : "free";
}

export function createCalendarModel(items, range) {
  const checked = assertDateRange(range);
  const visibleItems = occupancyItemsForRange(items, checked);
  const byDate = visibleItems.reduce((map, item) => {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
    return map;
  }, new Map());

  return Object.freeze(monthsInRange(checked).map((month) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const key = monthKey(month);
    const days = [];
    const count = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= count; day += 1) {
      const date = toIsoDate(new Date(year, monthIndex, day));
      const inRange = date >= checked.from && date <= checked.to;
      const dayItems = inRange ? Object.freeze(byDate.get(date) || []) : Object.freeze([]);
      days.push(Object.freeze({ date, day, inRange, status: inRange ? dayStatus(dayItems) : null, items: dayItems }));
    }
    return Object.freeze({ key, year, month: monthIndex + 1, offset: (month.getDay() + 6) % 7, days: Object.freeze(days) });
  }));
}
