(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const texts = config.texts || {};
  let currentOccupancyPayload = null;
  let currentOccupancyRange = null;
  let currentOccupancyStale = false;
  let occupancyRequestGeneration = 0;
  let occupancyAbortController = null;
  let occupancyLoadingGeneration = null;
  let preparedOccupancyPrintSnapshot = null;

  const occupancyDateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

  function cacheKey(range) {
    return window.FrontendCore.occupancyCacheKey(config.buildingId, range.from, range.to);
  }

  function legacyCacheKey(range) {
    return `occupancy:${config.buildingId}:${range.from}:${range.to}`;
  }

  function occupancyStorage() {
    try { return window.localStorage; } catch (error) { return null; }
  }

  function cleanupOccupancyCache() {
    const storage = occupancyStorage();
    const prefix = `occupancy:v2:${config.buildingId}:`;
    if (!storage || !config.buildingId) return;

    const keys = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(prefix)) keys.push(key);
      }
    } catch (error) {
      return;
    }

    keys.forEach((key) => {
      const result = window.FrontendCore.readStorage(storage, key);
      if (!result.ok) return;
      const parsed = window.FrontendCore.parseOccupancyCacheRecord(result.value);
      if (parsed.state === "expired" || parsed.state === "invalid") {
        window.FrontendCore.removeStorage(storage, key);
      }
    });
  }

  function removeOccupancyCache(range) {
    const storage = occupancyStorage();
    if (storage) window.FrontendCore.removeStorage(storage, cacheKey(range));
  }

  function readOccupancyCache(range) {
    const storage = occupancyStorage();
    if (!storage) return null;
    window.FrontendCore.removeStorage(storage, legacyCacheKey(range));
    const result = window.FrontendCore.readStorage(storage, cacheKey(range));
    if (!result.ok || result.value === null) return null;
    const parsed = window.FrontendCore.parseOccupancyCacheRecord(result.value);
    if (parsed.state !== "fresh") {
      removeOccupancyCache(range);
      return null;
    }
    return parsed.payload;
  }

  function writeOccupancyCache(range, payload) {
    const storage = occupancyStorage();
    if (!storage) return;
    const record = window.FrontendCore.createOccupancyCacheRecord(payload);
    window.FrontendCore.writeStorage(storage, cacheKey(range), JSON.stringify(record));
  }

  async function fetchOccupancy(range, signal) {
    if (!config.apiBaseUrl || config.apiBaseUrl.includes("DEPLOYMENT_" + "ID") || !config.buildingId) {
      throw new Error("Bitte Apps-Script- und Gebäude-Konfiguration prüfen.");
    }
    const url = new URL(config.apiBaseUrl);
    url.searchParams.set("action", "occupancy");
    url.searchParams.set("buildingId", config.buildingId);
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);
    const response = await fetch(url, { method: "GET", cache: "no-store", signal });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || "Die Daten konnten nicht geladen werden.");
    return payload.data;
  }

  function todayIso() {
    return iso(new Date());
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function clampRange(range) {
    const today = todayIso();
    return { from: range.from < today ? today : range.from, to: range.to };
  }

  function rangeFromSelection(value) {
    const select = document.getElementById("occupancyRange");
    if (value === "selected-month" && select && select.dataset.from && select.dataset.to) {
      return { from: select.dataset.from, to: select.dataset.to };
    }
    const now = new Date();
    const year = now.getFullYear();
    if (value === "current-month") return { from: todayIso(), to: iso(new Date(year, now.getMonth() + 1, 0)) };
    if (value === "next-month") return { from: todayIso(), to: iso(new Date(year, now.getMonth() + 2, 0)) };
    if (value === "year") return clampRange({ from: `${year}-01-01`, to: `${year}-12-31` });
    if (value === "next-year") return { from: `${year + 1}-01-01`, to: `${year + 1}-12-31` };
    return { from: todayIso(), to: iso(new Date(year, now.getMonth() + 1, 0)) };
  }

  function monthRange(month) {
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return clampRange({ from: iso(start), to: iso(end) });
  }

  function selectedView() {
    const select = document.getElementById("occupancyView");
    return select ? select.value : "plan";
  }

  function renderOccupancy(payload, range, stale) {
    if (selectedView() === "plan") {
      window.Ui.renderOccupancyPlan(payload.items || [], payload.loadedAt, stale, range);
      return;
    }
    window.Ui.renderOccupancy(payload.items || [], payload.loadedAt, stale);
  }

  function bookingItems(items) {
    return (items || []).filter((item) => item.statusKey !== "requested");
  }

  function occupancyItemsForRange(items, range) {
    return window.FrontendCore.sortOccupancyItems(bookingItems(items).filter((item) => item && item.date >= range.from && item.date <= range.to));
  }

  function normalizedOccupancyPayload(payload, range) {
    return {
      ...payload,
      items: occupancyItemsForRange(payload.items, range),
      loadedAt: payload.loadedAt || new Date().toISOString()
    };
  }

  function occupancyMeta(message) {
    const meta = document.getElementById("occupancyMeta");
    if (meta) meta.textContent = message;
  }

  function loadedAtText(loadedAt) {
    const date = new Date(loadedAt);
    return Number.isNaN(date.getTime()) ? String(loadedAt || "") : occupancyDateTimeFormatter.format(date);
  }

  function updateOccupancyMeta(payload, stale, error) {
    const currentLabel = texts.statusCurrent || "Stand";
    const staleLabel = texts.statusStale || "Möglicherweise veralteter Stand";
    const timestamp = loadedAtText(payload.loadedAt);
    occupancyMeta(`${stale ? staleLabel : currentLabel}: ${timestamp}${error ? ` · ${texts.occupancyLoadFailed || "Die Belegung konnte nicht geladen werden."} ${error.message}` : ""}`);
  }

  function printButton() {
    return document.getElementById("occupancyPrintButton");
  }

  function occupancyIsLoading() {
    return occupancyLoadingGeneration === occupancyRequestGeneration;
  }

  function setOccupancyLoading(isLoading, generation) {
    if (!isLoading && generation !== occupancyRequestGeneration) return;

    const list = document.getElementById("occupancyList");
    const refresh = document.querySelector('#occupancyFilter button[type="submit"]');
    const print = printButton();
    if (isLoading) {
      occupancyLoadingGeneration = generation;
      if (list) {
        list.setAttribute("inert", "");
        list.setAttribute("aria-busy", "true");
      }
      setButtonLoading(refresh, true, texts.updating || "Aktualisieren …");
      if (print) print.disabled = true;
      occupancyMeta(texts.occupancyUpdating || "Belegung wird aktualisiert …");
      return;
    }

    occupancyLoadingGeneration = null;
    if (list) {
      list.removeAttribute("inert");
      list.setAttribute("aria-busy", "false");
    }
    setButtonLoading(refresh, false);
    if (print) print.disabled = !currentOccupancyPayload || !currentOccupancyRange;
  }

  function printContainer() {
    return document.getElementById("occupancyPrint");
  }

  function invalidateOccupancyPrint() {
    preparedOccupancyPrintSnapshot = null;
    const target = printContainer();
    if (!target) return;
    target.replaceChildren();
    target.hidden = true;
  }

  function freezeOccupancyPrintItem(item) {
    return Object.freeze({
      date: String(item.date || ""),
      from: String(item.from || ""),
      to: String(item.to || ""),
      allDay: item.allDay === true,
      status: typeof item.status === "string" ? item.status : "",
      statusKey: typeof item.statusKey === "string" ? item.statusKey : "",
      publicTitle: typeof item.publicTitle === "string" ? item.publicTitle : "",
      publicOrganizer: typeof item.publicOrganizer === "string" ? item.publicOrganizer : ""
    });
  }

  function createOccupancyPrintSnapshot() {
    if (occupancyIsLoading() || !currentOccupancyPayload || !currentOccupancyRange) return null;
    const range = Object.freeze({ from: currentOccupancyRange.from, to: currentOccupancyRange.to });
    const items = Object.freeze(window.FrontendCore.sortOccupancyItems((currentOccupancyPayload.items || [])
      .filter((item) => item && item.date >= range.from && item.date <= range.to)
      .map(freezeOccupancyPrintItem)));
    return Object.freeze({
      building: config.buildingName || config.appTitle || texts.defaultBuilding || "Gebäude",
      range,
      view: selectedView(),
      loadedAt: currentOccupancyPayload.loadedAt || new Date().toISOString(),
      stale: currentOccupancyStale,
      online: navigator.onLine,
      createdAt: new Date().toISOString(),
      items
    });
  }

  function renderOccupancyPrint(snapshot) {
    const target = printContainer();
    if (!target || !window.Ui.renderOccupancyPrint) return;
    window.Ui.renderOccupancyPrint(target, snapshot);
    target.hidden = false;
  }

  function prepareOccupancyPrint() {
    const snapshot = createOccupancyPrintSnapshot();
    if (!snapshot) {
      invalidateOccupancyPrint();
      return false;
    }
    preparedOccupancyPrintSnapshot = snapshot;
    renderOccupancyPrint(snapshot);
    return true;
  }

  function ensureOccupancyPrintUi() {
    const button = printButton();
    if (button && !button.dataset.printBound) {
      button.dataset.printBound = "true";
      button.disabled = true;
      button.addEventListener("click", () => {
        if (prepareOccupancyPrint()) window.print();
      });
    }
    const target = printContainer();
    if (target) target.hidden = true;
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function validateBooking(data) {
    if (!data.date || !data.requesterName || !data.requesterContact || !data.title || data.privacyConsent !== "on") {
      return texts.bookingRequired;
    }
    if (data.allDay === "true") {
      data.from = "00:00";
      data.to = "23:59";
      return "";
    }
    if (!data.from || !data.to || data.from >= data.to) {
      return texts.invalidTime;
    }
    return "";
  }

  function validateContact(data) {
    if (!data.name || !data.contact || !data.subject || !data.message || data.privacyConsent !== "on") {
      return texts.contactRequired;
    }
    return "";
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + (loadingText || texts.loadingLower);
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || texts.sendFallback;
      delete button.dataset.originalHtml;
    }
  }

  function setFormLoading(form, isLoading) {
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector('.form-message');
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + texts.sending;
      if (message) {
        const label = button.dataset.originalHtml.replace(/ senden$/, '');
        message.textContent = label + ' ' + texts.sending;
        message.className = 'form-message';
      }
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || texts.sendFallback;
      delete button.dataset.originalHtml;
    }
  }

  async function loadBuilding() {
    try {
      const building = await window.Api.getBuilding();
      window.Ui.applyConfig({
        ...config,
        appTitle: config.appTitle || building.name,
        buildingName: config.buildingName || building.name,
        operatorName: config.operatorName || building.operatorName,
        contactEmail: config.contactEmail || building.contactEmail
      });
      const note = document.querySelector("[data-public-note]");
      const frontendPublicNote = typeof texts.publicNote === "string" ? texts.publicNote.trim() : "";
      const buildingPublicNote = typeof building.publicNote === "string" ? building.publicNote.trim() : "";
      if (note && !frontendPublicNote && buildingPublicNote) note.textContent = building.publicNote;
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadOccupancy() {
    const select = document.getElementById("occupancyRange");
    if (!select) return;
    const range = rangeFromSelection(select.value);
    const storage = occupancyStorage();
    cleanupOccupancyCache();
    if (storage) window.FrontendCore.removeStorage(storage, legacyCacheKey(range));
    invalidateOccupancyPrint();
    const generation = ++occupancyRequestGeneration;
    if (occupancyAbortController) occupancyAbortController.abort();
    occupancyAbortController = new AbortController();
    const signal = occupancyAbortController.signal;
    setOccupancyLoading(true, generation);
    try {
      const data = await fetchOccupancy(range, signal);
      if (generation !== occupancyRequestGeneration || signal.aborted) return;
      const payload = normalizedOccupancyPayload(data, range);
      currentOccupancyPayload = payload;
      currentOccupancyRange = range;
      currentOccupancyStale = false;
      writeOccupancyCache(range, payload);
      renderOccupancy(payload, range, currentOccupancyStale);
      updateOccupancyMeta(payload, false);
    } catch (error) {
      if (generation !== occupancyRequestGeneration || signal.aborted || error.name === "AbortError") return;
      const cached = readOccupancyCache(range);
      if (cached) {
        const payload = normalizedOccupancyPayload(cached, range);
        currentOccupancyPayload = payload;
        currentOccupancyRange = range;
        currentOccupancyStale = true;
        renderOccupancy(payload, range, currentOccupancyStale);
        updateOccupancyMeta(payload, true, error);
      } else {
        currentOccupancyPayload = null;
        currentOccupancyRange = null;
        currentOccupancyStale = false;
        invalidateOccupancyPrint();
        const dialog = document.getElementById("bookingDetailsDialog");
        if (dialog && dialog.open) dialog.close();
        const dialogContent = document.getElementById("bookingDetailsDialogContent");
        if (dialogContent) dialogContent.replaceChildren();
        occupancyMeta(`${texts.occupancyLoadFailed || "Die Belegung konnte nicht geladen werden."} ${error.message}`);
        window.Ui.renderEmpty(document.getElementById("occupancyList"), texts.occupancyLoadFailed);
      }
    } finally {
      if (generation === occupancyRequestGeneration) {
        occupancyAbortController = null;
        setOccupancyLoading(false, generation);
      }
    }
  }

  function prefillBookingRequest(date) {
    const form = document.getElementById("bookingForm");
    const message = document.getElementById("bookingMessage");
    form.elements.date.value = date;
    form.elements.allDay.value = "true";
    form.elements.allDay.dispatchEvent(new Event("change"));
    if (message) {
      message.textContent = texts.datePrefilled;
      message.className = "form-message";
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => form.elements.requesterName.focus({ preventScroll: true }), 350);
  }

  async function loadNews() {
    try {
      const data = await window.Api.getNews();
      const today = todayIso();
      const items = (data.items || [])
        .filter((item) => item.active !== false)
        .filter((item) => !item.validFrom || item.validFrom <= today)
        .filter((item) => !item.validUntil || item.validUntil >= today)
        .sort((a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999) || String(b.date || "").localeCompare(String(a.date || "")));
      window.Ui.renderNews(items);
    } catch (error) {
      window.Ui.renderEmpty(document.getElementById("newsList"), `${texts.newsLoadFailed} ${error.message}`);
    }
  }

  async function loadDownloads() {
    try {
      const data = await window.Api.getDownloads();
      window.Ui.renderDownloads(data.items || []);
    } catch (error) {
      window.Ui.renderEmpty(document.getElementById("downloadsList"), `${texts.downloadsLoadFailed} ${error.message}`);
    }
  }

  async function loadAbout() {
    try {
      const text = await window.Api.getAbout();
      window.Ui.renderAbout(text);
    } catch (error) {
      const container = document.getElementById("aboutContent");
      if (container) container.innerHTML = `<p class="empty">${window.Ui.escapeHtml(texts.aboutLoadFailed)} ${window.Ui.escapeHtml(error.message)}</p>`;
    }
  }

  function bindForms() {
    document.getElementById("occupancyFilter").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (occupancyIsLoading()) return;
      await loadOccupancy();
    });

    document.getElementById("occupancyRange").addEventListener("change", () => {
      loadOccupancy();
    });

    document.getElementById("occupancyView").addEventListener("change", () => {
      if (currentOccupancyPayload && currentOccupancyRange) {
        renderOccupancy(currentOccupancyPayload, currentOccupancyRange, currentOccupancyStale);
      }
    });

    document.getElementById("occupancyList").addEventListener("click", async (event) => {
      const detailButton = event.target.closest("[data-occupancy-date]");
      if (detailButton && currentOccupancyPayload) {
        const date = detailButton.dataset.occupancyDate;
        const items = (currentOccupancyPayload.items || []).filter((item) => item.date === date);
        window.Ui.openBookingDetailsDialog(date, items, detailButton);
        return;
      }
      const dayButton = event.target.closest("[data-booking-date]");
      if (dayButton) {
        prefillBookingRequest(dayButton.dataset.bookingDate);
        return;
      }

      const button = event.target.closest("[data-occupancy-month]");
      if (!button) return;
      const select = document.getElementById("occupancyRange");
      const option = select.querySelector('option[value="selected-month"]');
      const range = monthRange(button.dataset.occupancyMonth);
      select.dataset.from = range.from;
      select.dataset.to = range.to;
      option.textContent = button.dataset.occupancyMonthLabel || texts.rangeSelectedMonth;
      option.hidden = false;
      select.value = "selected-month";
      document.getElementById("occupancyView").value = "table";
      await loadOccupancy();
    });

    document.getElementById("bookingForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = document.getElementById("bookingMessage");
      const data = formData(form);
      const error = validateBooking(data);
      if (error) {
        message.textContent = error;
        message.className = "form-message is-error";
        return;
      }
      if (!navigator.onLine) {
        message.textContent = texts.bookingOffline;
        message.className = "form-message is-error";
        return;
      }
      setFormLoading(form, true);
      try {
        await window.Api.createBookingRequest(data);
        form.reset();
        message.textContent = texts.bookingSuccess;
        message.className = "form-message is-success";
        loadOccupancy();
      } catch (requestError) {
        message.textContent = requestError.message;
        message.className = "form-message is-error";
      } finally {
        setFormLoading(form, false);
      }
    });

    document.getElementById("contactForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = document.getElementById("contactMessage");
      const data = formData(form);
      const error = validateContact(data);
      if (error) {
        message.textContent = error;
        message.className = "form-message is-error";
        return;
      }
      if (!navigator.onLine) {
        message.textContent = texts.contactOffline;
        message.className = "form-message is-error";
        return;
      }
      setFormLoading(form, true);
      try {
        await window.Api.createContactRequest(data);
        form.reset();
        message.textContent = texts.contactSuccess;
        message.className = "form-message is-success";
      } catch (requestError) {
        message.textContent = requestError.message;
        message.className = "form-message is-error";
      } finally {
        setFormLoading(form, false);
      }
    });
  }

  function bindAllDay() {
    const form = document.getElementById("bookingForm");
    const allDay = form.elements.allDay;
    const from = form.elements.from;
    const to = form.elements.to;
    function sync() {
      const disabled = allDay.value === "true";
      from.disabled = disabled;
      to.disabled = disabled;
      from.required = !disabled;
      to.required = !disabled;
      if (disabled) {
        from.value = "00:00";
        to.value = "23:59";
      }
    }
    allDay.addEventListener("change", sync);
    sync();
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.Ui.applyConfig(config);
    window.Ui.setConnectionStatus();
    window.Ui.bindBookingDialog();
    ensureOccupancyPrintUi();
    bindForms();
    bindAllDay();
    loadBuilding();
    loadOccupancy();
    loadNews();
    loadDownloads();
    loadAbout();
    if ("serviceWorker" in navigator) {
      const scope = new URL("./", window.location.href).pathname;
      if (config.registerServiceWorker) {
        navigator.serviceWorker.register(`${scope}service-worker.js`, { scope }).catch(console.warn);
      } else {
        navigator.serviceWorker.getRegistration(scope).then((registration) => registration && registration.unregister()).catch(console.warn);
      }
    }
  });

  window.addEventListener("online", window.Ui.setConnectionStatus);
  window.addEventListener("offline", window.Ui.setConnectionStatus);
  window.addEventListener("beforeprint", prepareOccupancyPrint);
  window.addEventListener("afterprint", invalidateOccupancyPrint);
})();
