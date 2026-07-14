function valueOrFallback(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
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

function setText(document, selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function renderContactDetails(document, selector, value, fallback) {
  const lines = contactLines(value || fallback);
  document.querySelectorAll(selector).forEach((node) => {
    node.replaceChildren();
    lines.forEach((line, index) => {
      if (index) node.appendChild(document.createElement("br"));
      const email = line.match(/[^\s<>\x22\x27]+@[^\s<>\x22\x27]+\.[^\s<>\x22\x27]+/);
      if (!email) {
        node.appendChild(document.createTextNode(line));
        return;
      }
      const link = document.createElement("a");
      link.href = `mailto:${email[0]}`;
      link.textContent = line;
      node.appendChild(link);
    });
  });
}

export function mergeBuildingConfig(config, building = {}) {
  return {
    ...config,
    appTitle: valueOrFallback(config.appTitle, building.name),
    buildingName: valueOrFallback(config.buildingName, building.name),
    operatorName: valueOrFallback(config.operatorName, building.operatorName),
    contactEmail: valueOrFallback(config.contactEmail, building.contactEmail)
  };
}

export function applySiteConfig(document, config, building = {}) {
  const texts = config.texts || {};
  const effectiveConfig = mergeBuildingConfig(config, building);
  setText(document, "[data-app-title]", effectiveConfig.appTitle || texts.defaultAppTitle || "");
  setText(document, "[data-building-name]", effectiveConfig.buildingName || effectiveConfig.appTitle || texts.defaultBuilding || "");
  setText(document, "[data-hero-title]", effectiveConfig.heroTitle || effectiveConfig.buildingName || effectiveConfig.appTitle || texts.defaultBuilding || "");
  setText(document, "[data-hero-location]", effectiveConfig.heroLocation || "");
  setText(document, "[data-operator-name]", effectiveConfig.operatorName || texts.defaultOperator || "");
  renderContactDetails(
    document,
    "[data-contact-details]",
    effectiveConfig.contactDetails || effectiveConfig.contactEmail,
    texts.contactMissing || ""
  );
  document.querySelectorAll("[data-building-id-field]").forEach((field) => {
    field.value = effectiveConfig.buildingId || "";
  });

  const frontendNote = typeof texts.publicNote === "string" ? texts.publicNote.trim() : "";
  const buildingNote = typeof building.publicNote === "string" ? building.publicNote.trim() : "";
  setText(document, "[data-public-note]", frontendNote || buildingNote);
  document.title = effectiveConfig.appTitle || texts.defaultAppTitle || document.title;
  return effectiveConfig;
}

export function createSiteShell({
  document,
  window,
  navigator,
  api,
  config = {},
  logger = { warn() {} }
}) {
  const texts = config.texts || {};
  let effectiveConfig = { ...config };
  let started = false;
  let lifecycle = 0;
  let startPromise = null;

  function renderConnectionStatus() {
    const node = document.getElementById("connectionStatus");
    if (!node) return;
    node.hidden = navigator.onLine;
    node.textContent = navigator.onLine ? "" : texts.offline || "";
    node.className = "status-pill is-offline";
  }

  async function loadBuilding(expectedLifecycle = lifecycle) {
    if (!api || typeof api.getBuilding !== "function") return null;
    try {
      const building = await api.getBuilding();
      if (expectedLifecycle !== lifecycle) return null;
      effectiveConfig = applySiteConfig(document, config, building || {});
      return building;
    } catch (error) {
      logger.warn(error);
      return null;
    }
  }

  function start() {
    if (started) return startPromise;
    started = true;
    lifecycle += 1;
    const expectedLifecycle = lifecycle;
    effectiveConfig = applySiteConfig(document, config);
    renderConnectionStatus();
    window.addEventListener("online", renderConnectionStatus);
    window.addEventListener("offline", renderConnectionStatus);
    startPromise = loadBuilding(expectedLifecycle);
    return startPromise;
  }

  function getBuildingName() {
    return effectiveConfig.buildingName || effectiveConfig.appTitle || texts.defaultBuilding || "Gebäude";
  }

  function dispose() {
    if (!started) return;
    started = false;
    lifecycle += 1;
    startPromise = null;
    window.removeEventListener("online", renderConnectionStatus);
    window.removeEventListener("offline", renderConnectionStatus);
  }

  return { start, getBuildingName, renderConnectionStatus, dispose };
}
