import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeConfig, getRuntimeConfig, requireApiBaseUrl } from "../assets/js/config/runtime-config.js";
import { AppsScriptClientError, createAppsScriptClient } from "../assets/js/infrastructure/apps-script-client.js";

const config = {
  apiBaseUrl: "https://script.google.com/macros/s/test/exec",
  buildingId: "dgh_rb",
  texts: { greeting: "Grüße aus Büdingen" }
};

function response(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    async json() {
      if (options.jsonError) throw options.jsonError;
      return payload;
    }
  };
}

test("validiert, kopiert und friert APP_CONFIG an einer Grenze", () => {
  const source = structuredClone(config);
  const runtime = createRuntimeConfig(source);
  source.texts.greeting = "geändert";
  assert.equal(runtime.texts.greeting, "Grüße aus Büdingen");
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(runtime.texts), true);
  assert.equal(getRuntimeConfig({ APP_CONFIG: config }).buildingId, "dgh_rb");
  const placeholder = createRuntimeConfig({ ...config, apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec" });
  assert.equal(Object.isFrozen(placeholder), true);
  assert.throws(() => requireApiBaseUrl(placeholder), /Apps-Script-URL/);
  assert.equal(createRuntimeConfig({ buildingId: "dgh_rb" }).buildingId, "dgh_rb");
  assert.throws(() => createRuntimeConfig({ ...config, buildingId: "" }), /Konfiguration/);
});

test("sendet Occupancy-GET mit Range, no-store und AbortSignal", async () => {
  const calls = [];
  const controller = new AbortController();
  const client = createAppsScriptClient({
    config,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return response({ ok: true, data: { schemaVersion: 2, items: [] }, message: "OK" });
    }
  });
  const data = await client.getOccupancy({ from: "2026-07-01", to: "2026-07-31" }, { signal: controller.signal });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("action"), "occupancy");
  assert.equal(url.searchParams.get("buildingId"), "dgh_rb");
  assert.equal(url.searchParams.get("from"), "2026-07-01");
  assert.equal(url.searchParams.get("to"), "2026-07-31");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.signal, controller.signal);
  assert.deepEqual(data, { schemaVersion: 2, items: [] });
});

test("sendet POST als text/plain und setzt vertrauenswürdige Aktionsdaten zuletzt", async () => {
  let call;
  const client = createAppsScriptClient({
    config,
    fetch: async (url, options) => {
      call = { url, options };
      return response({ ok: true, data: { requestId: "äöüß" } });
    }
  });
  const result = await client.createBookingRequest({ title: "Feier", action: "falsch", buildingId: "falsch" });
  assert.equal(call.url, config.apiBaseUrl);
  assert.equal(call.options.method, "POST");
  assert.deepEqual(call.options.headers, { "Content-Type": "text/plain;charset=utf-8" });
  assert.deepEqual(JSON.parse(call.options.body), {
    title: "Feier", action: "createBookingRequest", buildingId: "dgh_rb"
  });
  assert.deepEqual(result, { requestId: "äöüß" });
});

test("unterscheidet Konfigurations-, JSON-, Envelope- und API-Fehler", async () => {
  let remoteFetches = 0;
  const invalidConfigClient = createAppsScriptClient({
    config: { ...config, apiBaseUrl: "ungültig" },
    fetch: async () => { remoteFetches += 1; return response({}); }
  });
  await assert.rejects(
    () => invalidConfigClient.getBuilding(),
    (error) => error instanceof AppsScriptClientError && error.code === "CONFIGURATION"
  );
  const placeholderClient = createAppsScriptClient({
    config: { ...config, apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec" },
    fetch: async () => { remoteFetches += 1; return response({}); }
  });
  await assert.rejects(() => placeholderClient.getOccupancy({ from: "2026-07-01", to: "2026-07-31" }), (error) =>
    error.code === "CONFIGURATION" && /Apps-Script-URL/.test(error.message)
  );
  const missingUrlClient = createAppsScriptClient({
    config: { buildingId: "dgh_rb" },
    fetch: async () => { remoteFetches += 1; return response({}); }
  });
  await assert.rejects(() => missingUrlClient.createContactRequest({ message: "Hallo" }), (error) =>
    error.code === "CONFIGURATION" && /Apps-Script-URL/.test(error.message)
  );
  assert.equal(remoteFetches, 0);
  const invalidJson = createAppsScriptClient({ config, fetch: async () => response(null, { jsonError: new SyntaxError("x") }) });
  await assert.rejects(() => invalidJson.getBuilding(), (error) => error.code === "INVALID_JSON");
  const invalidEnvelope = createAppsScriptClient({ config, fetch: async () => response({ data: {} }) });
  await assert.rejects(() => invalidEnvelope.getBuilding(), (error) => error.code === "INVALID_ENVELOPE");
  const apiError = createAppsScriptClient({ config, fetch: async () => response({ ok: false, message: "Wartungsarbeiten" }) });
  await assert.rejects(() => apiError.getBuilding(), (error) => error.code === "API_ERROR" && error.message === "Wartungsarbeiten");
  const httpError = createAppsScriptClient({ config, fetch: async () => response({ ok: true }, { ok: false, status: 503 }) });
  await assert.rejects(() => httpError.getBuilding(), /HTTP 503/);
  const transportError = createAppsScriptClient({ config, fetch: async () => { throw new TypeError("offline"); } });
  await assert.rejects(() => transportError.getBuilding(), (error) => error.code === "TRANSPORT");
  assert.throws(() => createAppsScriptClient({ config: null, fetch: async () => response({}) }), (error) => error.code === "CONFIGURATION");
});
