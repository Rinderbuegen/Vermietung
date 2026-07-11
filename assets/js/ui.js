(function () {
  "use strict";

  const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
  const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });
  const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
  const texts = (window.APP_CONFIG && window.APP_CONFIG.texts) || {};
  const weekdays = texts.weekdays || [];

  function text(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function markdown(value) {
    const safe = escapeHtml(value);
    return safe
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h3>$1</h3>")
      .replace(/^# (.*)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  function contactLines(value) {
    if (Array.isArray(value)) {
      return value.map((line) => String(line || "").trim()).filter(Boolean);
    }
    return String(value || "")
      .split(/<br\s*\/?\s*>|\r?\n/i)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function renderContactDetails(selector, value) {
    const lines = contactLines(value || texts.contactMissing);
    document.querySelectorAll(selector).forEach((node) => {
      node.innerHTML = lines.map((line) => {
        const email = line.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
        const safe = escapeHtml(line);
        return email ? `<a href="mailto:${escapeHtml(email[0])}">${safe}</a>` : safe;
      }).join("<br>");
    });
  }

  function renderEmpty(target, message) {
    target.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  }

  function renderOccupancy(items, loadedAt, stale) {
    const list = document.getElementById("occupancyList");
    const meta = document.getElementById("occupancyMeta");
    meta.textContent = `${stale ? texts.statusStale : texts.statusCurrent}: ${dateTimeFormatter.format(new Date(loadedAt))}`;

    if (!items.length) {
      renderEmpty(list, texts.occupancyEmpty);
      return;
    }

    list.innerHTML = items.map((item) => {
      const title = item.publicTitle ? `<strong>${escapeHtml(item.publicTitle)}</strong>` : "";
      const time = item.allDay ? texts.allDayDisplay : `${escapeHtml(item.from)} ${escapeHtml(texts.timeUntil)} ${escapeHtml(item.to)} ${escapeHtml(texts.timeSuffix)}`;
      return `
        <article class="list-item status-${escapeHtml(item.statusKey || "default")}">
          <div>
            <h3>${dateFormatter.format(new Date(item.date))}</h3>
            <p>${time}</p>
            ${title ? `<p>${title}</p>` : ""}
          </div>
          <span class="status-label">${escapeHtml(item.status)}</span>
        </article>`;
    }).join("");
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function monthKey(date) {
    return iso(date).slice(0, 7);
  }

  function monthsInRange(range) {
    const start = new Date(`${range.from.slice(0, 7)}-01T00:00:00`);
    const end = new Date(`${range.to.slice(0, 7)}-01T00:00:00`);
    const months = [];
    for (const current = new Date(start); current <= end; current.setMonth(current.getMonth() + 1)) {
      months.push(new Date(current));
    }
    return months;
  }

  function itemStatus(item) {
    if (!item) return "free";
    if (["confirmed", "blocked"].includes(item.statusKey) && item.allDay) return "busy";
    return "partial";
  }

  function dayStatus(items) {
    const statuses = items.map(itemStatus);
    if (statuses.includes("busy")) return "busy";
    if (statuses.includes("partial")) return "partial";
    return "free";
  }

  function renderMonth(month, itemsByDate, range) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const key = monthKey(firstDay);
    const label = monthFormatter.format(firstDay);
    const cells = [];

    for (let index = 0; index < offset; index += 1) {
      cells.push('<span class="occupancy-day is-empty" aria-hidden="true"></span>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${key}-${String(day).padStart(2, "0")}`;
      if (date < range.from || date > range.to) {
        cells.push(`<span class="occupancy-day is-out-of-range" aria-label="${escapeHtml(date)}: ${escapeHtml(texts.outsideRange)}">${day}</span>`);
        continue;
      }
      const status = dayStatus(itemsByDate.get(date) || []);
      const statusLabel = status === "busy" ? texts.statusBusy : status === "partial" ? texts.statusPartial : texts.statusFree;
      const dayLabel = dateFormatter.format(new Date(`${date}T00:00:00`));
      if (status === "free") {
        cells.push(`<button class="occupancy-day is-free" type="button" data-booking-date="${date}" title="${escapeHtml(texts.bookingFor)} ${escapeHtml(dayLabel)}" aria-label="${escapeHtml(dayLabel)}: ${escapeHtml(texts.statusFree)}, ${escapeHtml(texts.startBooking)}">${day}</button>`);
        continue;
      }
      cells.push(`<span class="occupancy-day is-${status}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(dayLabel)}: ${escapeHtml(statusLabel)}">${day}</span>`);
    }

    return `
      <article class="occupancy-month">
        <button class="occupancy-month-title" type="button" data-occupancy-month="${key}" data-occupancy-month-label="${escapeHtml(label)}" aria-label="${escapeHtml(label)} ${escapeHtml(texts.showAsTable)}">${escapeHtml(label)}</button>
        <div class="occupancy-weekdays" aria-hidden="true">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="occupancy-days">${cells.join("")}</div>
      </article>`;
  }

  function renderOccupancyPlan(items, loadedAt, stale, range) {
    const list = document.getElementById("occupancyList");
    const meta = document.getElementById("occupancyMeta");
    const itemsByDate = items.reduce((map, item) => {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
      return map;
    }, new Map());
    meta.textContent = `${stale ? texts.statusStale : texts.statusCurrent}: ${dateTimeFormatter.format(new Date(loadedAt))}`;
    list.innerHTML = `
      <div class="occupancy-plan" aria-label="${escapeHtml(texts.occupancyPlanLabel)}">
        ${monthsInRange(range).map((month) => renderMonth(month, itemsByDate, range)).join("")}
      </div>
      <div class="occupancy-legend" aria-label="${escapeHtml(texts.legendLabel)}">
        <span><i class="is-free"></i> ${escapeHtml(texts.statusFree)}</span>
        <span><i class="is-busy"></i> ${escapeHtml(texts.statusBusy)}</span>
        <span><i class="is-partial"></i> ${escapeHtml(texts.statusPartial)}</span>
      </div>`;
  }

  function renderNews(items) {
    const list = document.getElementById("newsList");
    if (!items.length) {
      renderEmpty(list, texts.newsEmpty);
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="list-item news-type-${escapeHtml(item.type || "info")}">
        <div>
          <p class="meta">${escapeHtml(item.type || "info")} · ${item.date ? dateFormatter.format(new Date(item.date)) : escapeHtml(texts.withoutDate)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <div class="markdown"><p>${markdown(item.body || "")}</p></div>
        </div>
      </article>`).join("");
  }

  function renderDownloads(items) {
    const list = document.getElementById("downloadsList");
    if (!items.length) {
      renderEmpty(list, texts.downloadsEmpty);
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="list-item">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || texts.pdfDocument)}</p>
          ${item.updatedAt ? `<p class="meta">${escapeHtml(texts.updatedItemLabel)} ${dateTimeFormatter.format(new Date(item.updatedAt))}</p>` : ""}
        </div>
        <a class="button button-secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(texts.openPdf)}</a>
      </article>`).join("");
  }

  function applyConfig(config) {
    text("[data-app-title]", config.appTitle || texts.defaultAppTitle);
    text("[data-building-name]", config.buildingName || config.appTitle || texts.defaultBuilding);
    text("[data-hero-title]", config.heroTitle || config.buildingName || config.appTitle || texts.defaultBuilding);
    text("[data-hero-location]", config.heroLocation || "");
    text("[data-operator-name]", config.operatorName || texts.defaultOperator);
    renderContactDetails("[data-contact-details]", config.contactDetails || config.contactEmail);
    document.querySelectorAll("[data-building-id-field]").forEach((field) => {
      field.value = config.buildingId || "";
    });
    document.title = config.appTitle || texts.defaultAppTitle;
  }

  function setConnectionStatus() {
    const node = document.getElementById("connectionStatus");
    if (!node) return;
    node.hidden = navigator.onLine;
    node.textContent = navigator.onLine ? "" : texts.offline;
    node.className = "status-pill is-offline";
  }

  function renderAbout(markdownText) {
    const container = document.getElementById("aboutContent");
    if (!container) return;
    container.innerHTML = `<p>${markdown(markdownText)}</p>`;
  }

  window.Ui = {
    applyConfig,
    setConnectionStatus,
    renderOccupancy,
    renderOccupancyPlan,
    renderNews,
    renderDownloads,
    renderAbout,
    renderEmpty,
    escapeHtml
  };
})();
