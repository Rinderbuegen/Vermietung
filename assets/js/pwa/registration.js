export function createPwaRegistration({
  navigator,
  location,
  URL,
  enabled,
  logger = { warn() {} }
}) {
  let startPromise = null;

  async function configure() {
    if (!navigator || !("serviceWorker" in navigator) || !location) return null;
    const scopeUrl = new URL("./", location.href);
    const scope = scopeUrl.pathname;
    const serviceWorker = navigator.serviceWorker;

    if (enabled) {
      const workerUrl = new URL("service-worker.js", scopeUrl).pathname;
      return serviceWorker.register(workerUrl, { scope });
    }

    const registration = await serviceWorker.getRegistration(scope);
    if (!registration || new URL(registration.scope, scopeUrl).href !== scopeUrl.href) return false;
    return registration.unregister();
  }

  function start() {
    if (!startPromise) {
      startPromise = configure().catch((error) => {
        logger.warn(error);
        return null;
      });
    }
    return startPromise;
  }

  return { start };
}
