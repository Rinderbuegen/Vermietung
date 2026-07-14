import { getRuntimeConfig, serviceWorkerRegistrationEnabled } from "./config/runtime-config.js";
import { createContent } from "./features/content.js";
import { createOccupancyController } from "./features/occupancy/controller.js";
import { createOccupancyPrint } from "./features/occupancy/print.js";
import { createOccupancyView } from "./features/occupancy/view.js";
import { createRequestForms } from "./features/request-forms.js";
import { createSiteShell } from "./features/site-shell.js";
import { createAppsScriptClient } from "./infrastructure/apps-script-client.js";
import { createContentRepository } from "./infrastructure/content-repository.js";
import { createOccupancyCache } from "./infrastructure/occupancy-cache.js";
import { createPwaRegistration } from "./pwa/registration.js";

export function createApplication({ window, document = window.document, pwaRegistration = null } = {}) {
  const config = getRuntimeConfig(window);
  const { navigator, location, FormData, AbortController, URL } = window;
  const logger = window.console;
  const fetch = window.fetch.bind(window);
  const setTimeout = window.setTimeout.bind(window);
  const clearTimeout = window.clearTimeout.bind(window);
  const api = createAppsScriptClient({ config, fetch });
  const contentRepository = createContentRepository({ config, fetch, baseUrl: location.href });
  const cache = createOccupancyCache({ buildingId: config.buildingId, storageFactory: () => window.localStorage });
  const siteShell = createSiteShell({ document, window, navigator, api, config, logger });
  const occupancyView = createOccupancyView({ document, setTimeout, clearTimeout, texts: config.texts });
  const occupancyPrint = createOccupancyPrint({
    document,
    window,
    navigator,
    texts: config.texts,
    getBuildingName: siteShell.getBuildingName,
    renderBookingDetails: occupancyView.renderBookingDetails
  });
  let requestForms;
  const occupancy = createOccupancyController({
    api,
    cache,
    view: occupancyView,
    print: occupancyPrint,
    AbortController,
    onBookingDate: (date) => requestForms.prefillBookingDate(date)
  });
  requestForms = createRequestForms({
    document,
    navigator,
    api,
    FormData,
    setTimeout,
    clearTimeout,
    texts: config.texts,
    onBookingCreated: () => occupancy.reload(),
    logger
  });
  const content = createContent({ document, api: contentRepository, texts: config.texts });
  const pwa = pwaRegistration || createPwaRegistration({
    navigator,
    location,
    URL,
    enabled: config.registerServiceWorker === true,
    logger
  });
  let startPromise = null;

  function start() {
    if (startPromise) return startPromise;
    requestForms.start();
    startPromise = Promise.allSettled([
      siteShell.start(),
      occupancy.start(),
      content.start(),
      pwa.start()
    ]);
    return startPromise;
  }

  function dispose() {
    occupancy.dispose();
    requestForms.dispose();
    content.dispose();
    siteShell.dispose();
  }

  return { start, dispose };
}

let bootstrapPromise = null;

export function bootstrap(runtime = {}) {
  if (!bootstrapPromise) {
    bootstrapPromise = Promise.resolve().then(async () => {
      const pwaRegistration = createPwaRegistration({
        navigator: runtime.window.navigator,
        location: runtime.window.location,
        URL: runtime.window.URL,
        enabled: serviceWorkerRegistrationEnabled(runtime.window),
        logger: runtime.window.console
      });
      void pwaRegistration.start();
      const application = createApplication({ ...runtime, pwaRegistration });
      await application.start();
      return application;
    });
  }
  return bootstrapPromise;
}

export function scheduleBootstrap(runtime) {
  const run = () => {
    void bootstrap(runtime).catch((error) => runtime.window.console.error(error));
  };
  if (runtime.document.readyState === "loading") {
    runtime.document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  scheduleBootstrap({ window, document });
}
