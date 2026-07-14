import { createCalendarModel, sortOccupancyItems } from "../../domain/occupancy.js";
import { monthRange, rangeFromPreset } from "../../domain/date-range.js";
import { render as renderRestrictedMarkdown } from "../../shared/restricted-markdown.js";

function statusClass(statusKey) {
  return /^[a-z0-9_-]+$/i.test(statusKey || "") ? statusKey : "default";
}

function detailText(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

function appendEmpty(document, target, message) {
  if (!target) return;
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message || "";
  target.replaceChildren(empty);
}

function statusText(status, texts) {
  if (status === "blocked") return texts.statusBlocked;
  if (status === "partial") return texts.statusPartial;
  if (status === "busy" || status === "confirmed") return texts.statusBusy;
  if (status === "free") return texts.statusFree;
  return texts.statusUnknown || "Status unbekannt";
}

export function createBookingDetailRenderer({
  texts = {},
  dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })
} = {}) {
  return function renderBookingDetails(target, item) {
    const document = target.ownerDocument;
    target.replaceChildren();
    const header = document.createElement("div");
    header.className = "booking-detail-header";
    const date = document.createElement("span");
    date.className = "booking-date-label";
    date.textContent = dateFormatter.format(new Date(`${item.date}T00:00:00`));
    const time = document.createElement("p");
    time.className = "booking-time";
    time.textContent = item.allDay
      ? texts.allDayDisplay
      : `${item.from} ${texts.timeUntil} ${item.to} ${texts.timeSuffix}`;
    header.append(date, time);
    if (item.statusKey !== "confirmed") {
      const status = document.createElement("span");
      status.className = `status-label status-${statusClass(item.statusKey)}`;
      status.textContent = detailText(item.status) || statusText(item.statusKey, texts);
      header.appendChild(status);
    }
    target.appendChild(header);

    [
      [texts.bookingEventLabel, detailText(item.publicTitle)],
      [texts.bookingOrganizerLabel, detailText(item.publicOrganizer)]
    ].forEach(([label, value]) => {
      if (!value) return;
      const section = document.createElement("section");
      section.className = "booking-detail-text";
      const heading = document.createElement("h4");
      heading.textContent = label || "";
      const content = document.createElement("div");
      renderRestrictedMarkdown(content, value, { profile: "details", newTabHint: texts.opensNewTab });
      section.append(heading, content);
      target.appendChild(section);
    });
    return target;
  };
}

export function createOccupancyView({
  document,
  setTimeout,
  clearTimeout,
  texts = {},
  now = () => new Date(),
  dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }),
  dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }),
  monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" })
}) {
  const renderBookingDetails = createBookingDetailRenderer({ texts, dateFormatter });
  const listeners = [];
  const timers = new Set();
  const refreshButtonContents = new Map();
  let handlers = {};
  let currentItems = [];
  let hasRenderedPayload = false;
  let dialogTrigger = null;
  let bound = false;

  function listen(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    listeners.push([target, type, handler]);
  }

  function reportHandlerError(error) {
    if (typeof handlers.onError !== "function") return;
    try {
      const result = handlers.onError(error);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      // Event errors must not escape into the browser event loop.
    }
  }

  function invokeHandler(name, ...args) {
    const handler = handlers[name];
    if (typeof handler !== "function") return;
    try {
      const result = handler(...args);
      if (result && typeof result.catch === "function") result.catch(reportHandlerError);
    } catch (error) {
      reportHandlerError(error);
    }
  }

  function invokeSelectionHandler(name) {
    try {
      invokeHandler(name, readSelection());
    } catch (error) {
      reportHandlerError(error);
    }
  }

  function readSelection() {
    const rangeSelect = document.getElementById("occupancyRange");
    const viewSelect = document.getElementById("occupancyView");
    const selectedRange = rangeSelect && rangeSelect.dataset.from && rangeSelect.dataset.to
      ? { from: rangeSelect.dataset.from, to: rangeSelect.dataset.to }
      : undefined;
    return {
      range: rangeFromPreset(rangeSelect ? rangeSelect.value : "current-month", { now: now(), selectedRange }),
      view: viewSelect ? viewSelect.value : "plan"
    };
  }

  function createBookingDetailsElement(item, className) {
    const article = document.createElement("article");
    article.className = `${className} status-${statusClass(item.statusKey)}`;
    renderBookingDetails(article, item);
    return article;
  }

  function renderList(items) {
    const list = document.getElementById("occupancyList");
    if (!list) return;
    if (!items.length) {
      appendEmpty(document, list, texts.occupancyEmpty);
      return;
    }
    list.replaceChildren(...sortOccupancyItems(items).map((item) =>
      createBookingDetailsElement(item, "list-item booking-details")
    ));
  }

  function createPlanDay(day) {
    if (!day.inRange) {
      const cell = document.createElement("span");
      cell.className = "occupancy-day is-out-of-range";
      cell.setAttribute("aria-label", `${day.date}: ${texts.outsideRange}`);
      cell.textContent = day.day;
      return cell;
    }
    const dayLabel = dateFormatter.format(new Date(`${day.date}T00:00:00`));
    const button = document.createElement("button");
    button.className = `occupancy-day is-${day.status}`;
    button.type = "button";
    button.textContent = day.day;
    if (day.status === "free") {
      button.dataset.bookingDate = day.date;
      button.title = `${texts.bookingFor} ${dayLabel}`;
      button.setAttribute("aria-label", `${dayLabel}: ${texts.statusFree}, ${texts.startBooking}`);
    } else {
      const label = statusText(day.status, texts);
      button.dataset.occupancyDate = day.date;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "bookingDetailsDialog");
      button.title = label;
      button.setAttribute("aria-label", `${dayLabel}: ${label}, ${texts.openDetails}`);
    }
    return button;
  }

  function createPlanMonth(month) {
    const article = document.createElement("article");
    article.className = "occupancy-month";
    const heading = document.createElement("h3");
    const button = document.createElement("button");
    const label = monthFormatter.format(new Date(`${month.key}-01T00:00:00`));
    button.className = "occupancy-month-title";
    button.type = "button";
    button.dataset.occupancyMonth = month.key;
    button.dataset.occupancyMonthLabel = label;
    button.setAttribute("aria-label", `${label} ${texts.showAsTable}`);
    button.textContent = label;
    heading.appendChild(button);

    const weekdays = document.createElement("div");
    weekdays.className = "occupancy-weekdays";
    weekdays.setAttribute("aria-hidden", "true");
    (texts.weekdays || []).forEach((weekday) => {
      const cell = document.createElement("span");
      cell.textContent = weekday;
      weekdays.appendChild(cell);
    });
    const days = document.createElement("div");
    days.className = "occupancy-days";
    for (let index = 0; index < month.offset; index += 1) {
      const empty = document.createElement("span");
      empty.className = "occupancy-day is-empty";
      empty.setAttribute("aria-hidden", "true");
      days.appendChild(empty);
    }
    month.days.forEach((day) => days.appendChild(createPlanDay(day)));
    article.append(heading, weekdays, days);
    return article;
  }

  function renderPlan(items, range) {
    const list = document.getElementById("occupancyList");
    if (!list) return;
    const plan = document.createElement("div");
    plan.className = "occupancy-plan";
    plan.setAttribute("aria-label", texts.occupancyPlanLabel || "");
    createCalendarModel(items, range).forEach((month) => plan.appendChild(createPlanMonth(month)));

    const legend = document.createElement("div");
    legend.className = "occupancy-legend";
    legend.setAttribute("aria-label", texts.legendLabel || "");
    [["free", texts.statusFree], ["busy", texts.statusBusy], ["partial", texts.statusPartial], ["blocked", texts.statusBlocked]].forEach(([status, label]) => {
      const entry = document.createElement("span");
      const symbol = document.createElement("i");
      symbol.className = `is-${status}`;
      const text = document.createTextNode(` ${label || ""}`);
      entry.append(symbol, text);
      legend.appendChild(entry);
    });
    list.replaceChildren(plan, legend);
  }

  function render(payload, range, stale = false) {
    currentItems = sortOccupancyItems(payload && payload.items ? payload.items : []);
    hasRenderedPayload = Boolean(payload && range);
    const selection = readSelection();
    if (selection.view === "plan") renderPlan(currentItems, range);
    else renderList(currentItems);
  }

  function renderMeta(payload, stale = false, error = null) {
    const meta = document.getElementById("occupancyMeta");
    if (!meta || !payload) return;
    const loadedAt = new Date(payload.loadedAt);
    const timestamp = Number.isNaN(loadedAt.getTime()) ? String(payload.loadedAt || "") : dateTimeFormatter.format(loadedAt);
    const label = stale ? texts.statusStale || "Möglicherweise veralteter Stand" : texts.statusCurrent || "Stand";
    const errorText = error ? ` · ${texts.occupancyLoadFailed || "Die Belegung konnte nicht geladen werden."} ${error.message}` : "";
    meta.textContent = `${label}: ${timestamp}${errorText}`;
  }

  function renderError(error) {
    currentItems = [];
    hasRenderedPayload = false;
    closeDialog();
    const meta = document.getElementById("occupancyMeta");
    if (meta) meta.textContent = `${texts.occupancyLoadFailed || "Die Belegung konnte nicht geladen werden."} ${error.message}`;
    appendEmpty(document, document.getElementById("occupancyList"), texts.occupancyLoadFailed);
  }

  function setRefreshLoading(button, loading) {
    if (!button) return;
    if (loading) {
      if (!refreshButtonContents.has(button)) refreshButtonContents.set(button, Array.from(button.childNodes));
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      button.replaceChildren(spinner, document.createTextNode(` ${texts.updating || "Aktualisieren …"}`));
      button.disabled = true;
      return;
    }
    const contents = refreshButtonContents.get(button);
    button.disabled = false;
    if (contents) button.replaceChildren(...contents);
    refreshButtonContents.delete(button);
  }

  function setLoading(loading) {
    const list = document.getElementById("occupancyList");
    const refresh = document.getElementById("occupancyRefreshButton")
      || document.querySelector('#occupancyFilter button[type="submit"]');
    const print = document.getElementById("occupancyPrintButton");
    if (list) {
      if (loading) list.setAttribute("inert", "");
      else list.removeAttribute("inert");
      list.setAttribute("aria-busy", String(loading));
    }
    setRefreshLoading(refresh, loading);
    if (print) print.disabled = loading || !hasRenderedPayload;
    if (loading) {
      const meta = document.getElementById("occupancyMeta");
      if (meta) meta.textContent = texts.occupancyUpdating || "Belegung wird aktualisiert …";
    }
  }

  function closeDialog() {
    const dialog = document.getElementById("bookingDetailsDialog");
    if (dialog && dialog.open) dialog.close();
    const content = document.getElementById("bookingDetailsDialogContent");
    if (content) content.replaceChildren();
  }

  function restoreDialogFocus() {
    const trigger = dialogTrigger;
    dialogTrigger = null;
    const timer = setTimeout(() => {
      timers.delete(timer);
      const view = document.getElementById("occupancyView");
      const heading = document.getElementById("occupancyHeading");
      if (trigger && trigger.isConnected) trigger.focus();
      else if (view) view.focus();
      else if (heading) heading.focus();
    }, 0);
    timers.add(timer);
  }

  function openDialog(date, items, trigger) {
    const dialog = document.getElementById("bookingDetailsDialog");
    const title = document.getElementById("bookingDetailsDialogTitle");
    const content = document.getElementById("bookingDetailsDialogContent");
    if (!dialog || !title || !content) return false;
    dialogTrigger = trigger || null;
    title.textContent = `${texts.bookingDetailsTitle}: ${dateFormatter.format(new Date(`${date}T00:00:00`))}`;
    content.replaceChildren(...sortOccupancyItems(items).map((item) =>
      createBookingDetailsElement(item, "booking-dialog-entry")
    ));
    dialog.showModal();
    const closeButton = dialog.querySelector("button");
    if (closeButton) closeButton.focus();
    return true;
  }

  function selectMonth(month, label) {
    const rangeSelect = document.getElementById("occupancyRange");
    const viewSelect = document.getElementById("occupancyView");
    if (!rangeSelect) return null;
    let range;
    try {
      range = monthRange(month, now());
    } catch (error) {
      reportHandlerError(error);
      return null;
    }
    if (!range || !range.from || !range.to || range.from > range.to) return null;
    const option = rangeSelect.querySelector('option[value="selected-month"]');
    rangeSelect.dataset.from = range.from;
    rangeSelect.dataset.to = range.to;
    if (option) {
      option.textContent = label || texts.rangeSelectedMonth;
      option.hidden = false;
    }
    rangeSelect.value = "selected-month";
    if (viewSelect) viewSelect.value = "table";
    return { range, view: viewSelect ? viewSelect.value : "plan" };
  }

  function handleListClick(event) {
    const detailButton = event.target.closest("[data-occupancy-date]");
    if (detailButton) {
      const date = detailButton.dataset.occupancyDate;
      openDialog(date, currentItems.filter((item) => item.date === date), detailButton);
      return;
    }
    const dayButton = event.target.closest("[data-booking-date]");
    if (dayButton) {
      invokeHandler("onBookingDate", dayButton.dataset.bookingDate);
      return;
    }
    const monthButton = event.target.closest("[data-occupancy-month]");
    if (!monthButton) return;
    const selection = selectMonth(monthButton.dataset.occupancyMonth, monthButton.dataset.occupancyMonthLabel);
    if (selection) invokeHandler("onSelectionChange", selection);
  }

  function bind(nextHandlers = {}) {
    handlers = nextHandlers;
    if (bound) return;
    bound = true;
    const filter = document.getElementById("occupancyFilter");
    const range = document.getElementById("occupancyRange");
    const view = document.getElementById("occupancyView");
    const list = document.getElementById("occupancyList");
    const dialog = document.getElementById("bookingDetailsDialog");
    listen(filter, "submit", (event) => {
      event.preventDefault();
      invokeSelectionHandler("onRefresh");
    });
    listen(range, "change", () => {
      invokeSelectionHandler("onSelectionChange");
    });
    listen(view, "change", () => {
      invokeSelectionHandler("onViewChange");
    });
    listen(list, "click", handleListClick);
    listen(dialog, "close", restoreDialogFocus);
  }

  function dispose() {
    listeners.splice(0).forEach(([target, type, handler]) => target.removeEventListener(type, handler));
    closeDialog();
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    refreshButtonContents.forEach((contents, button) => {
      button.disabled = false;
      button.replaceChildren(...contents);
    });
    refreshButtonContents.clear();
    handlers = {};
    currentItems = [];
    hasRenderedPayload = false;
    dialogTrigger = null;
    bound = false;
  }

  return {
    bind,
    readSelection,
    render,
    renderList,
    renderPlan,
    renderMeta,
    renderError,
    setLoading,
    openDialog,
    closeDialog,
    renderBookingDetails,
    dispose
  };
}
