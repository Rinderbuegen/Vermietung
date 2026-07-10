(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  let currentOccupancyPayload = null;
  let currentOccupancyRange = null;

  function occupancyCacheKey(range) {
    return `occupancy:${config.buildingId}:${range.from}:${range.to}`;
  }

  function todayIso() {
    return iso(new Date());
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
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
    if (value === "today") return { from: todayIso(), to: todayIso() };
    if (value === "four-weeks") return { from: todayIso(), to: iso(addDays(now, 28)) };
    if (value === "year") return clampRange({ from: `${year}-01-01`, to: `${year}-12-31` });
    if (value === "next-year") return { from: `${year + 1}-01-01`, to: `${year + 1}-12-31` };
    return { from: todayIso(), to: iso(addDays(now, 7)) };
  }

  function monthRange(month) {
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return clampRange({ from: iso(start), to: iso(end) });
  }

  function selectedView() {
    const select = document.getElementById("occupancyView");
    return select ? select.value : "table";
  }

  function renderOccupancy(payload, range) {
    if (selectedView() === "plan") {
      window.Ui.renderOccupancyPlan(payload.items || [], payload.loadedAt, false, range);
      return;
    }
    window.Ui.renderOccupancy(payload.items || [], payload.loadedAt, false);
  }

  function bookingItems(items) {
    return (items || []).filter((item) => item.statusKey !== "requested");
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function validateBooking(data) {
    if (!data.date || !data.requesterName || !data.requesterContact || !data.title || data.privacyConsent !== "on") {
      return "Bitte alle Pflichtfelder ausfüllen und den Hinweis bestätigen.";
    }
    if (data.allDay === "true") {
      data.from = "00:00";
      data.to = "23:59";
      return "";
    }
    if (!data.from || !data.to || data.from >= data.to) {
      return "Bitte eine gültige Uhrzeit eintragen. Start muss vor Ende liegen.";
    }
    return "";
  }

  function validateContact(data) {
    if (!data.name || !data.contact || !data.subject || !data.message || data.privacyConsent !== "on") {
      return "Bitte alle Pflichtfelder ausfüllen und den Datenschutzhinweis bestätigen.";
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
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + (loadingText || 'wird geladen …');
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || 'Absenden';
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
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> wird gesendet …';
      if (message) {
        const label = button.dataset.originalHtml.replace(/ senden$/, '');
        message.textContent = label + ' wird gesendet …';
        message.className = 'form-message';
      }
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || 'Absenden';
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
    try {
      const data = await window.Api.getOccupancy(range.from, range.to);
      const payload = { items: bookingItems(data.items), loadedAt: data.loadedAt || new Date().toISOString() };
      currentOccupancyPayload = payload;
      currentOccupancyRange = range;
      localStorage.setItem(occupancyCacheKey(range), JSON.stringify(payload));
      renderOccupancy(payload, range);
    } catch (error) {
      const cached = localStorage.getItem(occupancyCacheKey(range));
      if (cached) {
        const payload = JSON.parse(cached);
        payload.items = bookingItems(payload.items);
        currentOccupancyPayload = payload;
        currentOccupancyRange = range;
        if (selectedView() === "plan") {
          window.Ui.renderOccupancyPlan(payload.items || [], payload.loadedAt || new Date().toISOString(), true, range);
        } else {
          window.Ui.renderOccupancy(payload.items || [], payload.loadedAt || new Date().toISOString(), true);
        }
        meta.textContent += ` · Abruf fehlgeschlagen: ${error.message}`;
      } else {
        meta.textContent = `Abruf fehlgeschlagen: ${error.message}`;
        window.Ui.renderEmpty(document.getElementById("occupancyList"), "Die Belegung konnte nicht geladen werden.");
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
      message.textContent = "Datum wurde aus dem Belegungsplan übernommen.";
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
      window.Ui.renderEmpty(document.getElementById("newsList"), `Hinweise konnten nicht geladen werden: ${error.message}`);
    }
  }

  async function loadDownloads() {
    try {
      const data = await window.Api.getDownloads();
      window.Ui.renderDownloads(data.items || []);
    } catch (error) {
      window.Ui.renderEmpty(document.getElementById("downloadsList"), `Downloads konnten nicht geladen werden: ${error.message}`);
    }
  }

  function bindForms() {
    document.getElementById("occupancyFilter").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const meta = document.getElementById("occupancyMeta");
      setButtonLoading(button, true, 'wird aktualisiert …');
      if (meta) meta.textContent = 'Belegung wird aktualisiert …';
      try {
        await loadOccupancy();
      } finally {
        setButtonLoading(button, false);
      }
    });

    document.getElementById("occupancyView").addEventListener("change", () => {
      if (currentOccupancyPayload && currentOccupancyRange) {
        renderOccupancy(currentOccupancyPayload, currentOccupancyRange);
      }
    });

    document.getElementById("occupancyList").addEventListener("click", async (event) => {
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
      option.textContent = button.dataset.occupancyMonthLabel || "Ausgewählter Monat";
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
        message.textContent = "Sie sind offline. Buchungsanfragen können erst wieder online gesendet werden.";
        message.className = "form-message is-error";
        return;
      }
      setFormLoading(form, true);
      try {
        await window.Api.createBookingRequest(data);
        form.reset();
        message.textContent = "Ihre Anfrage wurde übermittelt. Sie ist noch keine verbindliche Buchung. Der Betreiber wird die Anfrage prüfen.";
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
        message.textContent = "Sie sind offline. Kontaktanfragen können erst wieder online gesendet werden.";
        message.className = "form-message is-error";
        return;
      }
      setFormLoading(form, true);
      try {
        await window.Api.createContactRequest(data);
        form.reset();
        message.textContent = "Ihre Kontaktanfrage wurde übermittelt.";
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
    bindForms();
    bindAllDay();
    loadBuilding();
    loadOccupancy();
    loadNews();
    loadDownloads();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
    }
  });

  window.addEventListener("online", window.Ui.setConnectionStatus);
  window.addEventListener("offline", window.Ui.setConnectionStatus);
})();
