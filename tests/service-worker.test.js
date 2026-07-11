const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "_site", "DGH", "service-worker.js"), "utf8");

function requestKey(request) {
  if (typeof request === "string") return request;
  return request.url || request.href;
}

function worker(scope, options = {}) {
  const handlers = {};
  const opened = [];
  const deleted = [];
  const fetchCalls = [];
  const lifecycle = { claimed: false, skipped: false };
  const entries = new Map(Object.entries(options.entries || {}));
  const cache = {
    async put(request, response) {
      entries.set(requestKey(request), response.clone());
    },
    async match(request) {
      const response = entries.get(requestKey(request));
      return response && response.clone();
    },
  };
  const self = {
    registration: { scope },
    location: new URL(scope),
    clients: {
      async claim() {
        await new Promise((resolve) => setTimeout(resolve, 5));
        lifecycle.claimed = true;
      },
    },
    async skipWaiting() { lifecycle.skipped = true; },
    addEventListener(name, handler) { handlers[name] = handler; },
  };
  const fetchImpl = options.fetch || (async () => new Response("network", { status: 200 }));
  const context = {
    self,
    URL,
    Request,
    Response,
    console,
    fetch: async (request) => {
      fetchCalls.push(requestKey(request));
      return fetchImpl(request);
    },
    caches: {
      async open(name) { opened.push(name); return cache; },
      async keys() { return options.cacheNames || []; },
      async delete(name) { deleted.push(name); return true; },
    },
  };
  vm.runInNewContext(source, context, { filename: "service-worker.js" });
  return { handlers, opened, deleted, entries, fetchCalls, lifecycle };
}

async function dispatchLifecycle(handler) {
  let lifecycle;
  handler({ waitUntil(promise) { lifecycle = promise; } });
  assert.equal(typeof lifecycle?.then, "function", "Lifecycle muss ein Promise registrieren");
  await lifecycle;
}

async function dispatchFetch(handler, request) {
  let responsePromise;
  handler({
    request,
    respondWith(promise) { responsePromise = Promise.resolve(promise); },
  });
  return {
    intercepted: Boolean(responsePromise),
    response: responsePromise && await responsePromise,
  };
}

function getRequest(url, overrides = {}) {
  return { url, method: "GET", mode: "cors", destination: "", ...overrides };
}

(async () => {
  const dghScope = "https://example.test/Vermietung/DGH/";
  const gemeindehausScope = "https://example.test/Vermietung/Gemeindehaus/";
  const dgh = worker(dghScope);
  const gemeindehaus = worker(gemeindehausScope);
  await dispatchLifecycle(dgh.handlers.install);
  await dispatchLifecycle(gemeindehaus.handlers.install);
  assert.equal(dgh.lifecycle.skipped, false, "Updates dürfen Aktivierung nicht erzwingen");

  const dghCache = dgh.opened[0];
  const gemeindehausCache = gemeindehaus.opened[0];
  assert.match(dghCache, /[a-f0-9]{12}$/);
  assert.match(gemeindehausCache, /[a-f0-9]{12}$/);
  assert.notEqual(dghCache, gemeindehausCache, "Scopes dürfen keinen Cache teilen");

  const oldDghCache = dghCache.replace(/[a-f0-9]{12}$/, "000000000000");
  const activation = worker(dghScope, {
    cacheNames: [oldDghCache, dghCache, gemeindehausCache, "fremde-anwendung-v1", "vermietung-v15"],
  });
  await dispatchLifecycle(activation.handlers.activate);
  assert.deepEqual(activation.deleted, [oldDghCache]);
  assert.equal(activation.lifecycle.claimed, true, "Activate muss clients.claim abwarten");

  const scriptUrl = `${dghScope}assets/js/app.js`;
  const networkUpdate = worker(dghScope, {
    entries: { [scriptUrl]: new Response("old") },
    fetch: async () => new Response("new", { status: 200 }),
  });
  const updated = await dispatchFetch(networkUpdate.handlers.fetch, getRequest(scriptUrl, { destination: "script" }));
  assert.equal(await updated.response.text(), "new", "App-Shell muss Network-First sein");
  assert.equal(await networkUpdate.entries.get(scriptUrl).text(), "new", "Erfolg muss Cache aktualisieren");

  const networkFailure = worker(dghScope, {
    entries: { [scriptUrl]: new Response("cached") },
    fetch: async () => { throw new TypeError("offline"); },
  });
  const fallback = await dispatchFetch(networkFailure.handlers.fetch, getRequest(scriptUrl, { destination: "script" }));
  assert.equal(await fallback.response.text(), "cached", "Netzfehler muss Cache verwenden");

  const indexUrl = `${dghScope}index.html`;
  const navigation = worker(dghScope, {
    entries: { [indexUrl]: new Response("DGH index") },
    fetch: async () => { throw new TypeError("offline"); },
  });
  const navigationFallback = await dispatchFetch(
    navigation.handlers.fetch,
    getRequest(`${dghScope}unbekannt`, { mode: "navigate" }),
  );
  assert.equal(await navigationFallback.response.text(), "DGH index", "Navigation braucht scope-eigenen Index");

  for (const asset of ["assets/icons/icon-192.png", "downloads/mietvertrag.pdf"]) {
    const assetUrl = `${dghScope}${asset}`;
    const binary = worker(dghScope, {
      entries: { [assetUrl]: new Response("binary cache") },
      fetch: async () => { throw new Error("Cache-First darf Netz nicht aufrufen"); },
    });
    const cached = await dispatchFetch(binary.handlers.fetch, getRequest(assetUrl));
    assert.equal(await cached.response.text(), "binary cache");
    assert.equal(binary.fetchCalls.length, 0, `${asset} muss Cache-First sein`);
  }

  const errorResponse = worker(dghScope, { fetch: async () => new Response("Fehler", { status: 503 }) });
  const failed = await dispatchFetch(errorResponse.handlers.fetch, getRequest(`${dghScope}assets/css/app.css`, { destination: "style" }));
  assert.equal(failed.response.status, 503);
  assert.equal(errorResponse.entries.size, 0, "Fehlerantworten dürfen nicht gecacht werden");

  for (const request of [
    getRequest("https://script.google.com/macros/s/test/exec"),
    getRequest(`${gemeindehausScope}assets/js/app.js`, { destination: "script" }),
    getRequest(scriptUrl, { method: "POST" }),
  ]) {
    const isolated = await dispatchFetch(dgh.handlers.fetch, request);
    assert.equal(isolated.intercepted, false, "Fremde Requests dürfen nicht abgefangen werden");
  }

  console.log("Service Worker geprüft: Strategien, Fallbacks, Cache-Regeln und Scope-Isolation.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
