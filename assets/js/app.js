(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const texts = config.texts || {};
  let currentOccupancyPayload = null;
  let currentOccupancyRange = null;
  let currentOccupancyStale = false;
  let occupancyRequestGeneration = 0;
  let occupancyAbortController = null;

  function cacheKey(range) {
    return window.FrontendCore.occupancyCacheKey(config.buildingId, range.from, range.to);
  }

  function legacyCacheKey(range) {
    return `occupancy:${config.buildingId}:${range.from}:${range.to}`;
  }

  function occupancyStorage() {
    try { return window.localStorage; } catch (error) { return null; }
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
    const response = await fetch(url, { method: "GET", signal });
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
      if (note && building.publicNote) note.textContent = building.publicNote;
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadOccupancy() {
    const select = document.getElementById("occupancyRange");
    const meta = document.getElementById("occupancyMeta");
    const range = rangeFromSelection(select.value);
    const storage = occupancyStorage();
    if (storage) window.FrontendCore.removeStorage(storage, legacyCacheKey(range));
    const generation = ++occupancyRequestGeneration;
    if (occupancyAbortController) occupancyAbortController.abort();
    occupancyAbortController = new AbortController();
    const signal = occupancyAbortController.signal;
    try {
      const data = await fetchOccupancy(range, signal);
      if (generation !== occupancyRequestGeneration || signal.aborted) return;
      const payload = { ...data, items: window.FrontendCore.sortOccupancyItems(bookingItems(data.items)), loadedAt: data.loadedAt || new Date().toISOString() };
      currentOccupancyPayload = payload;
      currentOccupancyRange = range;
      currentOccupancyStale = false;
      writeOccupancyCache(range, payload);
      renderOccupancy(payload, range, currentOccupancyStale);
    } catch (error) {
      if (generation !== occupancyRequestGeneration || error.name === "AbortError") return;
      const cached = readOccupancyCache(range);
      if (cached) {
        const payload = { ...cached, items: window.FrontendCore.sortOccupancyItems(bookingItems(cached.items)) };
        currentOccupancyPayload = payload;
        currentOccupancyRange = range;
        currentOccupancyStale = true;
        renderOccupancy(payload, range, currentOccupancyStale);
        meta.textContent += ` · ${texts.occupancyLoadFailed} ${error.message}`;
      } else {
        meta.textContent = `${texts.occupancyLoadFailed} ${error.message}`;
        window.Ui.renderEmpty(document.getElementById("occupancyList"), texts.occupancyLoadFailed);
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
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const meta = document.getElementById("occupancyMeta");
      setButtonLoading(button, true, texts.updating);
      if (meta) meta.textContent = texts.occupancyUpdating;
      try {
        await loadOccupancy();
      } finally {
        setButtonLoading(button, false);
      }
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
})();
