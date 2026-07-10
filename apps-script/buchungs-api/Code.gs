const SPREADSHEETS_BY_BUILDING_ID = {
  dgh_rb: "11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc",
  ev_gem_rb: "1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E"
};

const SHEET_HEADERS = {
  Buildings: ["building_id", "name", "operator_name", "contact_email", "active", "public_note"],
  Bookings: ["booking_id", "building_id", "date", "from", "to", "title", "status", "public_title", "internal_note", "created_at", "updated_at"],
  Requests: ["request_id", "building_id", "date", "from", "to", "requester_name", "requester_contact", "title", "note", "status", "conflict", "created_at", "updated_at"],
  Settings: ["building_id", "key", "value"],
  Log: ["timestamp", "building_id", "action", "reference_id", "message"],
  Contacts: ["contact_id", "building_id", "name", "contact", "subject", "message", "created_at"]
};

const STATUS_LABELS = {
  confirmed: "belegt",
  blocked: "gesperrt",
  requested: "angefragt"
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    const buildingId = requireBuildingId(params.buildingId);
    if (action === "building") return jsonOk(getBuilding(buildingId));
    if (action === "occupancy") return jsonOk(getOccupancy(buildingId, params.from, params.to));
    return jsonError("UNKNOWN_ACTION", "Diese Aktion ist nicht bekannt.");
  } catch (error) {
    return jsonError(error.code || "SERVER_ERROR", error.message || "Die Anfrage konnte nicht verarbeitet werden.");
  }
}

function doPost(e) {
  try {
    const data = parsePostData(e);
    const action = data.action;
    requireBuildingId(data.buildingId);
    if (action === "createBookingRequest") return jsonOk(createBookingRequest(data), "Anfrage wurde gespeichert.");
    if (action === "createContactRequest") return jsonOk(createContactRequest(data), "Kontaktanfrage wurde gespeichert.");
    return jsonError("UNKNOWN_ACTION", "Diese Aktion ist nicht bekannt.");
  } catch (error) {
    return jsonError(error.code || "SERVER_ERROR", error.message || "Die Anfrage konnte nicht verarbeitet werden.");
  }
}

function setupSheets() {
  Object.keys(SPREADSHEETS_BY_BUILDING_ID).forEach(setupSheetForBuilding);
}

function setupSheetForBuilding(buildingId) {
  const spreadsheet = openSpreadsheet(buildingId);
  Object.keys(SHEET_HEADERS).forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });

  upsertRow("Buildings", "building_id", buildingId, {
    building_id: buildingId,
    name: buildingId === "dgh_rb" ? "Dorfgemeinschaftshaus Rinderbügen" : "Evangelisches Gemeindehaus Rinderbügen",
    operator_name: buildingId === "dgh_rb" ? "Betreiber Dorfgemeinschaftshaus Rinderbügen" : "Betreiber Evangelisches Gemeindehaus Rinderbügen",
    contact_email: "kontakt@example.com",
    active: "true",
    public_note: "Bitte prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage."
  }, buildingId);

  upsertSetting(buildingId, "public_show_booking_titles", "false");
  upsertSetting(buildingId, "notify_email", "kontakt@example.com");
  upsertSetting(buildingId, "sheet_url", spreadsheet.getUrl());
}

function getBuilding(buildingId) {
  const rows = readRows(buildingId, "Buildings");
  const row = rows.find((item) => item.building_id === buildingId && isTruthy(item.active));
  if (!row) throw appError("NOT_FOUND", "Das Gebäude ist nicht aktiv oder nicht vorhanden.");
  return {
    buildingId: row.building_id,
    name: row.name,
    operatorName: row.operator_name,
    contactEmail: row.contact_email,
    publicNote: row.public_note
  };
}

function getOccupancy(buildingId, from, to) {
  assertActiveBuilding(buildingId);
  const range = normalizeDateRange(from, to);
  const settings = getSettings(buildingId);
  const showTitles = String(settings.public_show_booking_titles || "false") === "true";
  const showPending = String(settings.show_pending_requests_in_occupancy || "true") !== "false";
  const bookings = readRows(buildingId, "Bookings")
    .filter((row) => row.building_id === buildingId && ["confirmed", "blocked"].includes(row.status))
    .filter((row) => dateInRange(row.date, range.from, range.to))
    .map((row) => publicOccupancyRow(row, showTitles));
  const requests = showPending ? readRows(buildingId, "Requests")
    .filter((row) => row.building_id === buildingId && ["open", "open_with_conflict"].includes(row.status))
    .filter((row) => dateInRange(row.date, range.from, range.to))
    .map((row) => ({
      date: row.date,
      from: normalizeTime(row.from),
      to: normalizeTime(row.to),
      allDay: isAllDay(row.from, row.to),
      status: STATUS_LABELS.requested,
      statusKey: "requested",
      publicTitle: showTitles ? sanitizeText(row.title, 140) : ""
    })) : [];
  return {
    loadedAt: new Date().toISOString(),
    items: bookings.concat(requests).sort(sortByDateAndTime)
  };
}

function createBookingRequest(data) {
  const buildingId = requireBuildingId(data.buildingId);
  assertActiveBuilding(buildingId);
  const cleaned = validateBookingRequest(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const conflict = checkBookingConflict(buildingId, cleaned.date, cleaned.from, cleaned.to);
    const requestId = Utilities.getUuid();
    const now = new Date().toISOString();
    appendRow(buildingId, "Requests", {
      request_id: requestId,
      building_id: buildingId,
      date: cleaned.date,
      from: cleaned.from,
      to: cleaned.to,
      requester_name: cleaned.requesterName,
      requester_contact: cleaned.requesterContact,
      title: cleaned.title,
      note: cleaned.note,
      status: conflict ? "open_with_conflict" : "open",
      conflict: conflict ? "true" : "false",
      created_at: now,
      updated_at: now
    });
    logAction(buildingId, "createBookingRequest", requestId, conflict ? "Anfrage mit Konflikt gespeichert." : "Anfrage gespeichert.");
    sendNotificationEmail(buildingId, cleaned);
    return { requestId: requestId, conflict: conflict };
  } finally {
    lock.releaseLock();
  }
}

function createContactRequest(data) {
  const buildingId = requireBuildingId(data.buildingId);
  assertActiveBuilding(buildingId);
  const cleaned = {
    name: sanitizeRequired(data.name, "Name", 120),
    contact: sanitizeRequired(data.contact, "Kontaktmöglichkeit", 160),
    subject: sanitizeRequired(data.subject, "Betreff", 140),
    message: sanitizeRequired(data.message, "Nachricht", 1200)
  };
  const contactId = Utilities.getUuid();
  appendRow(buildingId, "Contacts", {
    contact_id: contactId,
    building_id: buildingId,
    name: cleaned.name,
    contact: cleaned.contact,
    subject: cleaned.subject,
    message: cleaned.message,
    created_at: new Date().toISOString()
  });
  logAction(buildingId, "createContactRequest", contactId, "Kontaktanfrage gespeichert.");
  return { contactId: contactId };
}

function checkBookingConflict(buildingId, date, from, to) {
  const newStart = toMinutes(from);
  const newEnd = toMinutes(to);
  return readRows(buildingId, "Bookings")
    .filter((row) => row.building_id === buildingId && row.date === date && ["confirmed", "blocked"].includes(row.status))
    .some((row) => newStart < toMinutes(row.to) && newEnd > toMinutes(row.from));
}

function logAction(buildingId, action, referenceId, message) {
  appendRow(buildingId, "Log", {
    timestamp: new Date().toISOString(),
    building_id: buildingId,
    action: action,
    reference_id: referenceId || "",
    message: sanitizeText(message || "", 500)
  });
}

function sendNotificationEmail(buildingId, requestData) {
  const settings = getSettings(buildingId);
  const target = settings.notify_email;
  if (!target) return;
  const building = getBuilding(buildingId);
  const sheetUrl = settings.sheet_url || openSpreadsheet(buildingId).getUrl();
  const body = [
    "Neue Buchungsanfrage",
    "",
    "Gebäude: " + building.name,
    "Datum: " + requestData.date,
    "Von: " + requestData.from,
    "Bis: " + requestData.to,
    "Name: " + requestData.requesterName,
    "Kontakt: " + requestData.requesterContact,
    "Zweck: " + requestData.title,
    "Bemerkung: " + (requestData.note || ""),
    "",
    "Google Sheet: " + sheetUrl
  ].join("\n");
  try {
    MailApp.sendEmail(target, "Neue Buchungsanfrage: " + building.name, body);
  } catch (error) {
    logAction(buildingId, "sendNotificationEmail", "", "E-Mail-Versand fehlgeschlagen: " + error.message);
  }
}

function parsePostData(e) {
  if (!e || !e.postData || !e.postData.contents) throw appError("VALIDATION_ERROR", "Keine Daten empfangen.");
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw appError("VALIDATION_ERROR", "Die gesendeten Daten sind ungültig.");
  }
}

function validateBookingRequest(data) {
  const date = sanitizeRequired(data.date, "Datum", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw appError("VALIDATION_ERROR", "Bitte prüfen Sie das Datum.");
  const from = data.allDay === "true" ? "00:00" : normalizeTime(data.from);
  const to = data.allDay === "true" ? "23:59" : normalizeTime(data.to);
  if (toMinutes(from) >= toMinutes(to)) throw appError("VALIDATION_ERROR", "Startzeit muss vor Endzeit liegen.");
  return {
    date: date,
    from: from,
    to: to,
    requesterName: sanitizeRequired(data.requesterName, "Name", 120),
    requesterContact: sanitizeRequired(data.requesterContact, "Kontaktmöglichkeit", 160),
    title: sanitizeRequired(data.title, "Zweck", 140),
    note: sanitizeText(data.note || "", 1000)
  };
}

function requireBuildingId(buildingId) {
  if (!buildingId || !SPREADSHEETS_BY_BUILDING_ID[buildingId]) throw appError("VALIDATION_ERROR", "Unbekannte Gebäude-ID.");
  return buildingId;
}

function assertActiveBuilding(buildingId) {
  getBuilding(buildingId);
}

function openSpreadsheet(buildingId) {
  return SpreadsheetApp.openById(SPREADSHEETS_BY_BUILDING_ID[requireBuildingId(buildingId)]);
}

function readRows(buildingId, sheetName) {
  const sheet = openSpreadsheet(buildingId).getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    const item = {};
    headers.forEach((header, index) => item[header] = formatCell(row[index], header));
    return item;
  });
}

function appendRow(buildingId, sheetName, data) {
  const spreadsheet = openSpreadsheet(buildingId);
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const headers = SHEET_HEADERS[sheetName];
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.appendRow(headers.map((header) => data[header] || ""));
}

function upsertSetting(buildingId, key, value) {
  const rows = readRows(buildingId, "Settings");
  const found = rows.find((row) => row.building_id === buildingId && row.key === key);
  if (!found) appendRow(buildingId, "Settings", { building_id: buildingId, key: key, value: value });
}

function upsertRow(sheetName, keyColumn, keyValue, data, buildingId) {
  const rows = readRows(buildingId, sheetName);
  const found = rows.find((row) => row[keyColumn] === keyValue);
  if (!found) appendRow(buildingId, sheetName, data);
}

function getSettings(buildingId) {
  return readRows(buildingId, "Settings")
    .filter((row) => row.building_id === buildingId)
    .reduce((settings, row) => {
      settings[row.key] = row.value;
      return settings;
    }, {});
}

function publicOccupancyRow(row, showTitles) {
  return {
    date: row.date,
    from: normalizeTime(row.from),
    to: normalizeTime(row.to),
    allDay: isAllDay(row.from, row.to),
    status: STATUS_LABELS[row.status] || row.status,
    statusKey: row.status,
    publicTitle: showTitles ? sanitizeText(row.public_title || row.title || "", 140) : ""
  };
}

function normalizeDateRange(from, to) {
  const today = new Date();
  const min = formatDate(today);
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 2);
  const max = formatDate(maxDate);
  const normalizedFrom = from && from > min ? from : min;
  const normalizedTo = to && to < max ? to : max;
  return { from: normalizedFrom, to: normalizedTo };
}

function dateInRange(date, from, to) {
  return date >= from && date <= to;
}

function normalizeTime(value) {
  const text = String(value || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(text)) throw appError("VALIDATION_ERROR", "Bitte prüfen Sie die Uhrzeit.");
  return text;
}

function toMinutes(value) {
  const parts = normalizeTime(value).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function isAllDay(from, to) {
  return normalizeTime(from) === "00:00" && normalizeTime(to) === "23:59";
}

function sanitizeRequired(value, label, maxLength) {
  const text = sanitizeText(value, maxLength);
  if (!text) throw appError("VALIDATION_ERROR", label + " ist erforderlich.");
  return text;
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatCell(value, header) {
  if (value instanceof Date && ["date", "valid_from", "valid_until"].includes(header)) return formatDate(value);
  if (value instanceof Date && ["from", "to"].includes(header)) return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  if (value instanceof Date) return value.toISOString();
  return String(value || "").trim();
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function isTruthy(value) {
  return ["true", "ja", "1", "yes"].includes(String(value).toLowerCase());
}

function sortByDateAndTime(a, b) {
  return String(a.date + a.from).localeCompare(String(b.date + b.from));
}

function jsonOk(data, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data || {}, message: message || "OK" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function appError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
