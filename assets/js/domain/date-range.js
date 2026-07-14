const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("Ungültiges Datum.");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(value) {
  const match = ISO_DATE.exec(value);
  if (!match) throw new TypeError("Datum muss dem Format YYYY-MM-DD entsprechen.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (toIsoDate(date) !== value) throw new TypeError("Ungültiges Kalenderdatum.");
  return date;
}

export function todayIso(now = new Date()) {
  return toIsoDate(now);
}

export function assertDateRange(range) {
  if (!range || typeof range !== "object") throw new TypeError("Ungültiger Zeitraum.");
  parseIsoDate(range.from);
  parseIsoDate(range.to);
  if (range.from > range.to) throw new RangeError("Der Zeitraum endet vor seinem Beginn.");
  return { from: range.from, to: range.to };
}

export function clampRange(range, now = new Date()) {
  const checked = assertDateRange(range);
  const today = todayIso(now);
  if (checked.to < today) return null;
  return { from: checked.from < today ? today : checked.from, to: checked.to };
}

function endOfMonth(year, monthIndex) {
  return toIsoDate(new Date(year, monthIndex + 1, 0));
}

export function rangeFromPreset(preset, options = {}) {
  const now = options.now || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === "selected-month" && options.selectedRange) return assertDateRange(options.selectedRange);
  if (preset === "next-month") return { from: todayIso(now), to: endOfMonth(year, month + 1) };
  if (preset === "year") return clampRange({ from: `${year}-01-01`, to: `${year}-12-31` }, now);
  if (preset === "next-year") return { from: `${year + 1}-01-01`, to: `${year + 1}-12-31` };
  return { from: todayIso(now), to: endOfMonth(year, month) };
}

export function monthRange(month, now = new Date()) {
  const match = ISO_MONTH.exec(month);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new TypeError("Monat muss dem Format YYYY-MM entsprechen.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return clampRange({ from: `${month}-01`, to: endOfMonth(year, monthIndex) }, now);
}

export function monthKey(date) {
  return toIsoDate(date).slice(0, 7);
}

export function monthsInRange(range) {
  const checked = assertDateRange(range);
  const start = parseIsoDate(`${checked.from.slice(0, 7)}-01`);
  const end = parseIsoDate(`${checked.to.slice(0, 7)}-01`);
  const months = [];
  for (const current = new Date(start); current <= end; current.setMonth(current.getMonth() + 1)) {
    months.push(new Date(current));
  }
  return months;
}
