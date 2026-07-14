import { createCalendarModel, occupancyItemsForRange } from "../../domain/occupancy.js";

function statusClass(statusKey) {
  return /^[a-z0-9_-]+$/i.test(statusKey || "") ? statusKey : "default";
}

function formatDateTime(formatter, value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : formatter.format(date);
}

export function createOccupancyPrintSnapshot({
  payload,
  range,
  view,
  buildingName,
  stale = false,
  online = true,
  createdAt = new Date().toISOString()
}) {
  if (!payload || !range) return null;
  const frozenRange = Object.freeze({ from: range.from, to: range.to });
  const items = Object.freeze(occupancyItemsForRange(payload.items, frozenRange));
  return Object.freeze({
    buildingName: String(buildingName || ""),
    range: frozenRange,
    view: view === "plan" ? "plan" : "table",
    loadedAt: typeof payload.loadedAt === "string" ? payload.loadedAt : "",
    stale: stale === true,
    online: online !== false,
    createdAt: String(createdAt || ""),
    items
  });
}

export const projectOccupancyPrintSnapshot = createOccupancyPrintSnapshot;

export function createOccupancyPrint({
  document,
  window,
  navigator,
  texts = {},
  getBuildingName,
  renderBookingDetails,
  now = () => new Date(),
  dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }),
  dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }),
  monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" })
}) {
  let source = null;
  let loading = false;
  let preparedSnapshot = null;
  let bound = false;

  function target() {
    return document.getElementById("occupancyPrint");
  }

  function button() {
    return document.getElementById("occupancyPrintButton");
  }

  function appendField(parent, label, value) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label || "";
    description.textContent = value || "";
    row.append(term, description);
    parent.appendChild(row);
  }

  function renderHeader(container, snapshot) {
    const header = document.createElement("header");
    header.className = "occupancy-print-header";
    const title = document.createElement("h1");
    title.textContent = `${texts.occupancyTitle}: ${snapshot.buildingName || texts.defaultBuilding}`;
    const fields = document.createElement("dl");
    const rangeText = snapshot.range.from && snapshot.range.to
      ? `${dateFormatter.format(new Date(`${snapshot.range.from}T00:00:00`))} ${texts.timeUntil} ${dateFormatter.format(new Date(`${snapshot.range.to}T00:00:00`))}`
      : "";
    appendField(fields, texts.printRangeLabel, rangeText);
    appendField(fields, texts.printViewLabel, snapshot.view === "plan" ? texts.viewPlan : texts.viewTable);
    appendField(fields, texts.printDataStatusLabel, formatDateTime(dateTimeFormatter, snapshot.loadedAt));
    appendField(fields, texts.printCreatedAtLabel, formatDateTime(dateTimeFormatter, snapshot.createdAt));
    header.append(title, fields);
    if (snapshot.stale) {
      const stale = document.createElement("p");
      stale.className = "occupancy-print-notice";
      stale.textContent = texts.statusStale || "";
      header.appendChild(stale);
    }
    if (!snapshot.online) {
      const offline = document.createElement("p");
      offline.className = "occupancy-print-notice";
      offline.textContent = texts.printOffline || "";
      header.appendChild(offline);
    }
    container.appendChild(header);
  }

  function renderDetails(container, items, className = "occupancy-print-details") {
    const section = document.createElement("section");
    section.className = className;
    const title = document.createElement("h2");
    title.textContent = texts.printDetailsTitle || "";
    section.appendChild(title);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = texts.occupancyEmpty || "";
      section.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "occupancy-print-list";
      items.forEach((item) => {
        const article = document.createElement("article");
        article.className = `booking-details occupancy-print-entry status-${statusClass(item.statusKey)}`;
        renderBookingDetails(article, item);
        list.appendChild(article);
      });
      section.appendChild(list);
    }
    container.appendChild(section);
  }

  function createStatusPattern(status) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("occupancy-print-status-pattern");
    svg.dataset.status = status;
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const lines = status === "busy"
      ? [[0, 0, 100, 100], [0, 100, 100, 0]]
      : status === "partial"
        ? [[0, 100, 100, 0]]
        : status === "blocked"
          ? [[-50, 100, 50, 0], [-17, 100, 83, 0], [17, 100, 117, 0], [50, 100, 150, 0]]
          : [];
    lines.forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      svg.appendChild(line);
    });
    return svg;
  }

  function renderMonth(month) {
    const article = document.createElement("article");
    article.className = "occupancy-print-month";
    const heading = document.createElement("h3");
    heading.textContent = monthFormatter.format(new Date(`${month.key}-01T00:00:00`));
    const weekdays = document.createElement("div");
    weekdays.className = "occupancy-print-weekdays";
    (texts.weekdays || []).forEach((weekday) => {
      const cell = document.createElement("span");
      cell.textContent = weekday;
      weekdays.appendChild(cell);
    });
    const days = document.createElement("div");
    days.className = "occupancy-print-days";
    for (let index = 0; index < month.offset; index += 1) {
      const blank = document.createElement("span");
      blank.className = "occupancy-print-day is-empty";
      days.appendChild(blank);
    }
    month.days.forEach((day) => {
      const cell = document.createElement("span");
      cell.className = "occupancy-print-day";
      const number = document.createElement("span");
      number.className = "occupancy-print-day-number";
      number.textContent = day.day;
      cell.appendChild(number);
      if (!day.inRange) {
        cell.classList.add("is-out-of-range");
      } else {
        cell.classList.add(`is-${day.status}`);
        cell.appendChild(createStatusPattern(day.status));
      }
      days.appendChild(cell);
    });
    article.append(heading, weekdays, days);
    return article;
  }

  function renderLegend(container) {
    const legend = document.createElement("section");
    legend.className = "occupancy-print-legend";
    const title = document.createElement("h2");
    title.textContent = texts.legendLabel || "";
    legend.appendChild(title);
    [
      ["free", texts.printLegendFree],
      ["busy", texts.printLegendBusy],
      ["partial", texts.printLegendPartial],
      ["blocked", texts.printLegendBlocked]
    ].forEach(([status, label]) => {
      const entry = document.createElement("span");
      entry.className = "occupancy-print-legend-entry";
      const symbol = document.createElement("span");
      symbol.className = `occupancy-print-legend-symbol is-${status}`;
      symbol.appendChild(createStatusPattern(status));
      const text = document.createElement("span");
      text.textContent = label || "";
      entry.append(symbol, text);
      legend.appendChild(entry);
    });
    container.appendChild(legend);
  }

  function render(snapshot) {
    const container = target();
    if (!container) return false;
    container.replaceChildren();
    if (!snapshot || !snapshot.range) {
      container.hidden = true;
      return false;
    }
    renderHeader(container, snapshot);
    if (snapshot.view !== "plan") {
      renderDetails(container, snapshot.items);
      container.hidden = false;
      return true;
    }
    const plan = document.createElement("section");
    plan.className = "occupancy-print-plan";
    createCalendarModel(snapshot.items, snapshot.range).forEach((month) => plan.appendChild(renderMonth(month)));
    container.appendChild(plan);
    renderLegend(container);
    renderDetails(container, snapshot.items, "occupancy-print-details occupancy-print-details-page");
    container.hidden = false;
    return true;
  }

  function invalidate() {
    preparedSnapshot = null;
    const container = target();
    if (!container) return;
    container.replaceChildren();
    container.hidden = true;
  }

  function update(nextSource) {
    source = nextSource && nextSource.payload && nextSource.range ? {
      payload: nextSource.payload,
      range: nextSource.range,
      view: nextSource.view,
      stale: nextSource.stale === true
    } : null;
    invalidate();
    const printButton = button();
    if (printButton) printButton.disabled = loading || !source;
  }

  function setLoading(nextLoading) {
    loading = nextLoading === true;
    if (loading) invalidate();
    const printButton = button();
    if (printButton) printButton.disabled = loading || !source;
  }

  function prepare() {
    if (loading || !source) {
      invalidate();
      return false;
    }
    const createdAt = now();
    preparedSnapshot = createOccupancyPrintSnapshot({
      ...source,
      buildingName: getBuildingName(),
      online: navigator.onLine,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt
    });
    return render(preparedSnapshot);
  }

  function handlePrintClick() {
    if (prepare()) window.print();
  }

  function bind() {
    if (bound) return;
    bound = true;
    const printButton = button();
    if (printButton) {
      printButton.disabled = loading || !source;
      printButton.addEventListener("click", handlePrintClick);
    }
    const container = target();
    if (container) container.hidden = true;
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", invalidate);
  }

  function dispose() {
    if (bound) {
      const printButton = button();
      if (printButton) printButton.removeEventListener("click", handlePrintClick);
      window.removeEventListener("beforeprint", prepare);
      window.removeEventListener("afterprint", invalidate);
    }
    bound = false;
    loading = false;
    source = null;
    invalidate();
    const printButton = button();
    if (printButton) printButton.disabled = true;
  }

  return { bind, update, setLoading, prepare, render, invalidate, dispose };
}
