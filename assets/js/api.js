(function () {
  "use strict";

  const config = window.APP_CONFIG || {};

  function assertConfig() {
    if (!config.apiBaseUrl || config.apiBaseUrl.includes("DEPLOYMENT_ID")) {
      throw new Error("Bitte Apps-Script-URL in config/config.js eintragen.");
    }
    if (!config.buildingId) {
      throw new Error("Bitte Gebäude-Konfiguration unter config/<Gebäude>/config.js prüfen.");
    }
  }

  function urlFor(action, params) {
    assertConfig();
    const url = new URL(config.apiBaseUrl);
    url.searchParams.set("action", action);
    url.searchParams.set("buildingId", config.buildingId);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  async function get(action, params) {
    const response = await fetch(urlFor(action, params), { method: "GET" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Die Daten konnten nicht geladen werden.");
    }
    return payload.data;
  }

  async function post(action, data) {
    assertConfig();
    const response = await fetch(config.apiBaseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...data, action, buildingId: config.buildingId })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Die Anfrage konnte nicht gesendet werden.");
    }
    return payload.data;
  }

  async function getLocalContent(fileName) {
    const response = await fetch(`assets/data/${fileName}`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Die lokalen Inhalte konnten nicht geladen werden.");
    }
    const payload = await response.json();
    const items = (payload.items || []).filter((item) => item.buildingId === config.buildingId || item.buildingId === "*");
    return { ...payload, items };
  }

  async function getAbout() {
    const data = await getLocalContent("about.json");
    const item = data.items[0];
    if (!item) throw new Error("Kein Über-Dokument hinterlegt.");
    const base = self.location.pathname.replace(/\/[^/]*$/, "/");
    const response = await fetch(new URL(item.url, self.location.origin + base).href, { cache: "no-cache" });
    if (!response.ok) throw new Error("Das Über-Dokument konnte nicht geladen werden.");
    return await response.text();
  }

  window.Api = {
    getBuilding: () => get("building"),
    getOccupancy: (from, to) => get("occupancy", { from, to }),
    getNews: () => getLocalContent("news.json"),
    getDownloads: () => getLocalContent("downloads.json"),
    getAbout,
    createBookingRequest: (data) => post("createBookingRequest", data),
    createContactRequest: (data) => post("createContactRequest", data)
  };
})();
