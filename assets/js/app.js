(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const occupancyCacheKey = `occupancy:${config.buildingId}`;

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function iso(date) {
    return date.toISOString().slice(0, 10);
  }

  function rangeFromSelection(value) {
    const now = new Date();
    const year = now.getFullYear();
    if (value === "today") return { from: todayIso(), to: todayIso() };
    if (value === "four-weeks") return { from: todayIso(), to: iso(addDays(now, 28)) };
    if (value === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
    if (value === "next-year") return { from: `${year + 1}-01-01`, to: `${year + 1}-12-31` };
    return { from: todayIso(), to: iso(addDays(now, 7)) };
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

  async function loadBuilding() {
    try {
      const building = await window.Api.getBuilding();
      window.Ui.applyConfig({
        ...config,
        appTitle: building.name || config.appTitle,
        buildingName: building.name || config.buildingName,
        operatorName: building.operatorName || config.operatorName,
        contactEmail: building.contactEmail || config.contactEmail
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
      const payload = { items: data.items || [], loadedAt: data.loadedAt || new Date().toISOString() };
      localStorage.setItem(occupancyCacheKey, JSON.stringify(payload));
      window.Ui.renderOccupancy(payload.items, payload.loadedAt, false);
    } catch (error) {
      const cached = localStorage.getItem(occupancyCacheKey);
      if (cached) {
        const payload = JSON.parse(cached);
        window.Ui.renderOccupancy(payload.items || [], payload.loadedAt || new Date().toISOString(), true);
        meta.textContent += ` · Abruf fehlgeschlagen: ${error.message}`;
      } else {
        meta.textContent = `Abruf fehlgeschlagen: ${error.message}`;
        window.Ui.renderEmpty(document.getElementById("occupancyList"), "Die Belegung konnte nicht geladen werden.");
      }
    }
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
    document.getElementById("occupancyFilter").addEventListener("submit", (event) => {
      event.preventDefault();
      loadOccupancy();
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
      try {
        await window.Api.createBookingRequest(data);
        form.reset();
        message.textContent = "Ihre Anfrage wurde übermittelt. Sie ist noch keine verbindliche Buchung. Der Betreiber wird die Anfrage prüfen.";
        message.className = "form-message is-success";
        loadOccupancy();
      } catch (requestError) {
        message.textContent = requestError.message;
        message.className = "form-message is-error";
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
      try {
        await window.Api.createContactRequest(data);
        form.reset();
        message.textContent = "Ihre Kontaktanfrage wurde übermittelt.";
        message.className = "form-message is-success";
      } catch (requestError) {
        message.textContent = requestError.message;
        message.className = "form-message is-error";
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
