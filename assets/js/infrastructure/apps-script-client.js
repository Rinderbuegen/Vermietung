import {
  CONFIGURATION_MESSAGE,
  REMOTE_API_CONFIGURATION_MESSAGE,
  createRuntimeConfig,
  requireApiBaseUrl
} from "../config/runtime-config.js";
import { assertDateRange } from "../domain/date-range.js";

export class AppsScriptClientError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.name = "AppsScriptClientError";
    this.code = code;
  }
}

function checkedConfig(config) {
  try {
    return createRuntimeConfig(config);
  } catch (cause) {
    throw new AppsScriptClientError(CONFIGURATION_MESSAGE, "CONFIGURATION", { cause });
  }
}

async function readEnvelope(response) {
  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new AppsScriptClientError("Die API hat keine gültige JSON-Antwort geliefert.", "INVALID_JSON", { cause });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.ok !== "boolean") {
    throw new AppsScriptClientError("Die API-Antwort hat ein ungültiges Format.", "INVALID_ENVELOPE");
  }
  if (!response.ok || !payload.ok) {
    const fallback = response.ok ? "Die Anfrage konnte nicht verarbeitet werden." : `Die API antwortete mit HTTP ${response.status}.`;
    throw new AppsScriptClientError(typeof payload.message === "string" && payload.message ? payload.message : fallback, "API_ERROR");
  }
  return payload.data;
}

export function createAppsScriptClient(options = {}) {
  let config;
  try {
    config = checkedConfig(options.config);
  } catch (error) {
    if (error instanceof AppsScriptClientError) throw error;
    throw new AppsScriptClientError(CONFIGURATION_MESSAGE, "CONFIGURATION", { cause: error });
  }
  const fetchImpl = options.fetch;
  if (typeof fetchImpl !== "function") throw new AppsScriptClientError("Fetch ist nicht verfügbar.", "CONFIGURATION");

  async function request(url, requestOptions) {
    try {
      return await fetchImpl(url, requestOptions);
    } catch (cause) {
      if (cause && cause.name === "AbortError") throw cause;
      throw new AppsScriptClientError("Die API konnte nicht erreicht werden.", "TRANSPORT", { cause });
    }
  }

  function remoteApiBaseUrl() {
    try {
      return requireApiBaseUrl(config);
    } catch (cause) {
      throw new AppsScriptClientError(REMOTE_API_CONFIGURATION_MESSAGE, "CONFIGURATION", { cause });
    }
  }

  function actionUrl(action, params = {}) {
    const url = new URL(remoteApiBaseUrl());
    url.searchParams.set("action", action);
    url.searchParams.set("buildingId", config.buildingId);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    return url;
  }

  async function get(action, params = {}, requestOptions = {}) {
    const response = await request(actionUrl(action, params), {
      method: "GET",
      ...(requestOptions.cache ? { cache: requestOptions.cache } : {}),
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {})
    });
    return readEnvelope(response);
  }

  async function post(action, data = {}, requestOptions = {}) {
    const response = await request(remoteApiBaseUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...data, action, buildingId: config.buildingId }),
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {})
    });
    return readEnvelope(response);
  }

  return Object.freeze({
    get,
    post,
    getBuilding: (options) => get("building", {}, options),
    getOccupancy: (range, { signal } = {}) => {
      const checked = assertDateRange(range);
      return get("occupancy", checked, { cache: "no-store", signal });
    },
    createBookingRequest: (data, options) => post("createBookingRequest", data, options),
    createContactRequest: (data, options) => post("createContactRequest", data, options)
  });
}
