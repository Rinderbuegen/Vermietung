(function () {
  "use strict";

  const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
  const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

  function text(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  function setLink(selector, href, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.href = href;
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

  function renderEmpty(target, message) {
    target.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  }

  function renderOccupancy(items, loadedAt, stale) {
    const list = document.getElementById("occupancyList");
    const meta = document.getElementById("occupancyMeta");
    meta.textContent = `${stale ? "Möglicherweise veralteter Stand" : "Stand"}: ${dateTimeFormatter.format(new Date(loadedAt))}`;

    if (!items.length) {
      renderEmpty(list, "Für diesen Zeitraum sind keine Belegungen eingetragen.");
      return;
    }

    list.innerHTML = items.map((item) => {
      const title = item.publicTitle ? `<strong>${escapeHtml(item.publicTitle)}</strong>` : "";
      const time = item.allDay ? "Ganzer Tag" : `${escapeHtml(item.from)} bis ${escapeHtml(item.to)} Uhr`;
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

  function renderNews(items) {
    const list = document.getElementById("newsList");
    if (!items.length) {
      renderEmpty(list, "Aktuell liegen keine Hinweise vor.");
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="list-item news-type-${escapeHtml(item.type || "info")}">
        <div>
          <p class="meta">${escapeHtml(item.type || "info")} · ${item.date ? dateFormatter.format(new Date(item.date)) : "ohne Datum"}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <div class="markdown"><p>${markdown(item.body || "")}</p></div>
        </div>
      </article>`).join("");
  }

  function renderDownloads(items) {
    const list = document.getElementById("downloadsList");
    if (!items.length) {
      renderEmpty(list, "Aktuell sind keine PDF-Downloads hinterlegt.");
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="list-item">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || "PDF-Dokument")}</p>
          ${item.updatedAt ? `<p class="meta">Aktualisiert: ${dateTimeFormatter.format(new Date(item.updatedAt))}</p>` : ""}
        </div>
        <a class="button button-secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">PDF öffnen</a>
      </article>`).join("");
  }

  function applyConfig(config) {
    text("[data-app-title]", config.appTitle || "Gebäudevermietung");
    text("[data-building-name]", config.buildingName || config.appTitle || "Gebäude");
    text("[data-operator-name]", config.operatorName || "Betreiber");
    setLink("[data-contact-email]", `mailto:${config.contactEmail || ""}`, config.contactEmail || "Kontakt nicht hinterlegt");
    document.querySelectorAll("[data-building-id-field]").forEach((field) => {
      field.value = config.buildingId || "";
    });
    document.title = config.appTitle || "Gebäudevermietung";
  }

  function setConnectionStatus() {
    const node = document.getElementById("connectionStatus");
    if (!node) return;
    node.hidden = navigator.onLine;
    node.textContent = navigator.onLine ? "" : "Offline. Es wird möglicherweise ein älterer Stand angezeigt.";
    node.className = "status-pill is-offline";
  }

  window.Ui = {
    applyConfig,
    setConnectionStatus,
    renderOccupancy,
    renderNews,
    renderDownloads,
    renderEmpty,
    escapeHtml
  };
})();
