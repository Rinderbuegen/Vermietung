const BACKEND_CONFIG = {
  "buildings": {
    "dgh_rb": {
      "spreadsheetId": "11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc",
      "name": "Dorfgemeinschaftshaus Rinderbügen",
      "operatorName": "Betreiber Dorfgemeinschaftshaus Rinderbügen",
      "contactEmail": "kontakt@example.com",
      "notifyEmail": "kontakt@example.com",
      "publicNote": "Bitte prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage.",
      "publicShowBookingDetails": false,
      "active": true
    },
    "ev_gem_rb": {
      "spreadsheetId": "1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E",
      "name": "Evangelisches Gemeindehaus Rinderbügen",
      "operatorName": "Betreiber Evangelisches Gemeindehaus Rinderbügen",
      "contactEmail": "kontakt@example.com",
      "notifyEmail": "kontakt@example.com",
      "publicNote": "Bitte prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage.",
      "publicShowBookingDetails": false,
      "active": true
    }
  }
};
const SPREADSHEETS_BY_BUILDING_ID = Object.keys(BACKEND_CONFIG.buildings).reduce((result, buildingId) => {
  result[buildingId] = BACKEND_CONFIG.buildings[buildingId].spreadsheetId;
  return result;
}, {});
const BACKEND_TEXTS = {
  "unknownAction": "Diese Aktion ist nicht bekannt.",
  "serverError": "Die Anfrage konnte nicht verarbeitet werden.",
  "bookingStored": "Anfrage wurde gespeichert.",
  "contactStored": "Kontaktanfrage wurde gespeichert.",
  "mailBookingSubject": "Neue Buchungsanfrage"
};

const SHEET_HEADERS = {
  Buildings: ["building_id", "name", "operator_name", "contact_email", "active", "public_note"],
  Bookings: ["booking_id", "building_id", "date", "from", "to", "title", "status", "public_title", "public_title_visible", "public_organizer", "public_organizer_visible", "created_at", "updated_at", "internal_note"],
  Requests: ["request_id", "building_id", "date", "from", "to", "requester_name", "requester_contact", "title", "note", "status", "conflict", "created_at", "updated_at", "internal_note"],
  Settings: ["building_id", "key", "value"],
  Log: ["timestamp", "building_id", "action", "reference_id", "message"],
  Contacts: ["contact_id", "building_id", "name", "contact", "subject", "message", "created_at"]
};

const LEGACY_SHEET_HEADERS_V12 = {
  Bookings: ["booking_id", "building_id", "date", "from", "to", "title", "status", "public_title", "internal_note", "created_at", "updated_at"],
  Requests: ["request_id", "building_id", "date", "from", "to", "requester_name", "requester_contact", "title", "note", "status", "conflict", "created_at", "updated_at"]
};
const MIGRATION_CHUNK_SIZE = 500;
const MAINTENANCE_MARKER_KEY = "maintenance_migrate_sheets_v13";

const STATUS_LABELS = {
  confirmed: "belegt",
  blocked: "gesperrt"
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    const buildingId = requireBuildingId(params.buildingId);
    if (action === "building") return jsonOk(getBuilding(buildingId));
    if (action === "occupancy") return jsonOk(getOccupancy(buildingId, params.from, params.to));
    return jsonError("UNKNOWN_ACTION", BACKEND_TEXTS.unknownAction);
  } catch (error) {
    return jsonError(error.code || "SERVER_ERROR", error.message || BACKEND_TEXTS.serverError);
  }
}

function doPost(e) {
  try {
    const data = parsePostData(e);
    const action = data.action;
    requireBuildingId(data.buildingId);
    if (action === "createBookingRequest") return jsonOk(createBookingRequest(data), BACKEND_TEXTS.bookingStored);
    if (action === "createContactRequest") return jsonOk(createContactRequest(data), BACKEND_TEXTS.contactStored);
    return jsonError("UNKNOWN_ACTION", BACKEND_TEXTS.unknownAction);
  } catch (error) {
    return jsonError(error.code || "SERVER_ERROR", error.message || BACKEND_TEXTS.serverError);
  }
}

function setupSheets() {
  const plans = Object.keys(SPREADSHEETS_BY_BUILDING_ID).map(preflightSetupSpreadsheet_);
  plans.forEach(applySetupSpreadsheet_);
}

function setupSheetForBuilding(buildingId) {
  applySetupSpreadsheet_(preflightSetupSpreadsheet_(buildingId));
}

function preflightSetupSpreadsheet_(buildingId) {
  const spreadsheet = openSpreadsheet(buildingId);
  const existing = Object.keys(SHEET_HEADERS).map((sheetName) => ({ sheetName: sheetName, sheet: spreadsheet.getSheetByName(sheetName) }));
  const productive = spreadsheet.getSheets().some((sheet) => sheet.getLastRow() > 1);
  existing.forEach((entry) => {
    if (!entry.sheet) {
      if (productive) throw appError("SCHEMA_ERROR", "Einrichtung abgebrochen: " + buildingId + " / Tab \"" + entry.sheetName + "\" fehlt in einem bereits befüllten Spreadsheet.");
      return;
    }
    if (entry.sheet.getLastRow() > 0) readAndClassifyHeaders_(entry.sheet, entry.sheetName);
  });
  return { buildingId: buildingId, spreadsheet: spreadsheet, existing: existing };
}

function applySetupSpreadsheet_(plan) {
  const buildingId = plan.buildingId;
  const initial = BACKEND_CONFIG.buildings[buildingId];
  Object.keys(SHEET_HEADERS).forEach((sheetName) => {
    const sheet = plan.spreadsheet.getSheetByName(sheetName) || plan.spreadsheet.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, SHEET_HEADERS[sheetName].length).setValues([SHEET_HEADERS[sheetName]]);
    sheet.setFrozenRows(1);
    if (headersEqual_(readHeaderCells_(sheet), SHEET_HEADERS[sheetName])) applySheetFormattingV13_(sheetName, sheet);
  });

  upsertRow("Buildings", "building_id", buildingId, {
    building_id: buildingId,
    name: initial.name,
    operator_name: initial.operatorName,
    contact_email: initial.contactEmail,
    active: String(initial.active),
    public_note: initial.publicNote
  }, buildingId);

  upsertSetting(buildingId, "public_show_booking_details", initial.publicShowBookingDetails);
  upsertSetting(buildingId, "notify_email", initial.notifyEmail);
  upsertSetting(buildingId, "sheet_url", plan.spreadsheet.getUrl());
}

function getBuilding(buildingId) {
  assertSheetSchema_(buildingId, "Buildings", false);
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
  assertMutationSheets_(buildingId, ["Buildings", "Bookings", "Settings"]);
  assertActiveBuilding(buildingId);
  const range = normalizeDateRange(from, to);
  const settings = getSettings(buildingId);
  const showDetails = publicBookingDetailsEnabled(settings);
  const bookings = readRows(buildingId, "Bookings")
    .filter((row) => row.building_id === buildingId && ["confirmed", "blocked"].includes(row.status))
    .filter((row) => dateInRange(row.date, range.from, range.to))
    .map((row) => publicOccupancyRow(row, showDetails));
  return {
    schemaVersion: 2,
    loadedAt: new Date().toISOString(),
    items: bookings.sort(sortByDateAndTime)
  };
}

function createBookingRequest(data) {
  const buildingId = requireBuildingId(data.buildingId);
  const cleaned = validateBookingRequest(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertMutationSheets_(buildingId, ["Buildings", "Bookings", "Requests", "Settings", "Log"]);
    assertActiveBuilding(buildingId);
    assertMaintenanceMarkerInactive_(buildingId);
    getSettings(buildingId);
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
      updated_at: now,
      internal_note: ""
    });
    SpreadsheetApp.flush();
    runPostPersistence_(buildingId, "createBookingRequest", requestId, cleaned, conflict);
    return { requestId: requestId, conflict: conflict };
  } finally {
    lock.releaseLock();
  }
}

function createContactRequest(data) {
  const buildingId = requireBuildingId(data.buildingId);
  const cleaned = {
    name: sanitizeRequired(data.name, "Name", 120),
    contact: sanitizeRequired(data.contact, "Kontaktmöglichkeit", 160),
    subject: sanitizeRequired(data.subject, "Betreff", 140),
    message: sanitizeRequired(data.message, "Nachricht", 1200)
  };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertMutationSheets_(buildingId, ["Buildings", "Contacts", "Log"]);
    assertActiveBuilding(buildingId);
    assertMaintenanceMarkerInactive_(buildingId);
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
    SpreadsheetApp.flush();
    try {
      logAction(buildingId, "createContactRequest", contactId, "Kontaktanfrage gespeichert.");
    } catch (error) {
      console.log("Kontaktanfrage gespeichert, Protokollierung fehlgeschlagen: " + error.message);
    }
    return { contactId: contactId };
  } finally {
    lock.releaseLock();
  }
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
    BACKEND_TEXTS.mailBookingSubject,
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
    MailApp.sendEmail(target, BACKEND_TEXTS.mailBookingSubject + ": " + building.name, body);
  } catch (error) {
    console.log("E-Mail-Versand fehlgeschlagen: " + error.message);
  }
}

function runPostPersistence_(buildingId, action, requestId, requestData, conflict) {
  try {
    logAction(buildingId, action, requestId, conflict ? "Anfrage mit Konflikt gespeichert." : "Anfrage gespeichert.");
  } catch (error) {
    console.log("Buchungsanfrage gespeichert, Protokollierung fehlgeschlagen: " + error.message);
  }
  try {
    sendNotificationEmail(buildingId, requestData);
  } catch (error) {
    console.log("Buchungsanfrage gespeichert, E-Mail-Versand fehlgeschlagen: " + error.message);
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

function readHeaderCells_(sheet) {
  const width = sheet.getLastColumn();
  if (width < 1) return [];
  return sheet.getRange(1, 1, 1, width).getValues()[0].map((value) => String(value).trim());
}

function headersEqual_(actual, expected) {
  return actual.length === expected.length && actual.every((header, index) => header === expected[index]);
}

function assertExactHeaders_(actual, allowed, context) {
  const hasEmpty = actual.some((header) => !header);
  const hasDuplicate = new Set(actual).size !== actual.length;
  if (hasEmpty || hasDuplicate || !allowed.some((headers) => headersEqual_(actual, headers))) {
    throw appError("SCHEMA_ERROR", "Schemafehler: " + context + " hat unbekannte, leere, doppelte oder falsch angeordnete Kopfzeilen.");
  }
}

function readAndClassifyHeaders_(sheet, sheetName) {
  const headers = readHeaderCells_(sheet);
  const allowed = sheetName === "Bookings" || sheetName === "Requests"
    ? [SHEET_HEADERS[sheetName], LEGACY_SHEET_HEADERS_V12[sheetName]]
    : [SHEET_HEADERS[sheetName]];
  if (!allowed[0]) throw appError("SCHEMA_ERROR", "Unbekannter Tab: " + sheetName);
  assertExactHeaders_(headers, allowed, "Tab \"" + sheetName + "\"");
  return {
    headers: headers,
    schema: headersEqual_(headers, SHEET_HEADERS[sheetName]) ? "v13" : "v12"
  };
}

function assertSheetSchema_(buildingId, sheetName, allowLegacy) {
  const sheet = openSpreadsheet(buildingId).getSheetByName(sheetName);
  if (!sheet) throw appError("SCHEMA_ERROR", buildingId + " / Tab \"" + sheetName + "\" fehlt.");
  const classified = readAndClassifyHeaders_(sheet, sheetName);
  if (!allowLegacy && classified.schema !== "v13") {
    throw appError("SCHEMA_ERROR", buildingId + " / Tab \"" + sheetName + "\" hat nicht das Schema von Version 1.3.");
  }
  return classified;
}

function assertMutationSheets_(buildingId, sheetNames) {
  sheetNames.forEach((sheetName) => assertSheetSchema_(buildingId, sheetName, sheetName === "Bookings" || sheetName === "Requests"));
}

function migrateSheetsV13() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const backups = [];
  let migrationPlan;
  let maintenanceMarkerAttempted = false;
  try {
    migrationPlan = preflightAllSpreadsheetsV13_();
    const timestamp = Utilities.formatDate(new Date(), "UTC", "yyyyMMdd_HHmmss");
    assertBackupSlotsAvailableV13_(migrationPlan, timestamp);
    maintenanceMarkerAttempted = true;
    setMaintenanceMarkersV13_(migrationPlan, true);
    migrationPlan.forEach((buildingPlan) => {
      buildingPlan.backups.forEach((sheetName) => {
        backups.push(backupSheetV13_(buildingPlan.sheets[sheetName], timestamp));
      });
    });
    migrationPlan.forEach((buildingPlan) => {
      ["Bookings", "Requests"].forEach((sheetName) => {
        const sheetPlan = buildingPlan.sheetPlans[sheetName];
        if (sheetPlan.schema === "v12") migrateRowsByHeaderV13_(sheetPlan.sheet, sheetPlan.headers, SHEET_HEADERS[sheetName]);
        applySheetFormattingV13_(sheetName, sheetPlan.sheet);
      });
      if (buildingPlan.settingAction !== "none") migratePublicDetailsSettingV13_(buildingPlan.buildingId);
      logMigrationResultV13_(buildingPlan.buildingId, "Migration V1.3 abgeschlossen (" + buildingPlan.oldSchemas + ").");
      console.log("Migration V1.3: " + buildingPlan.buildingId + ", " + buildingPlan.oldSchemas + ", Backups: " + buildingPlan.backups.join(", "));
    });
    setMaintenanceMarkersV13_(migrationPlan, false);
  } catch (error) {
    const backupText = backups.length ? " Wiederherstellung aus folgenden Sicherungen prüfen: " + backups.join(", ") + "." : "";
    if (maintenanceMarkerAttempted) {
      try {
        setMaintenanceMarkersV13_(migrationPlan, true);
      } catch (markerError) {
        console.log("Wartungsmarker konnte nicht erneut gesetzt werden: " + markerError.message);
      }
      throw new Error("Migration abgebrochen. " + error.message + backupText + " Der Wartungsmarker \"" + MAINTENANCE_MARKER_KEY + "\" bleibt aktiv. Nach Wiederherstellung aus den Sicherungen den Marker in beiden Settings-Tabs manuell auf false setzen.");
    }
    throw new Error("Migration abgebrochen. " + error.message + backupText);
  } finally {
    lock.releaseLock();
  }
}

function preflightAllSpreadsheetsV13_() {
  const plans = Object.keys(SPREADSHEETS_BY_BUILDING_ID).map(preflightSpreadsheetV13_);
  return Object.freeze(plans.map((plan) => Object.freeze({
    buildingId: plan.buildingId,
    spreadsheet: plan.spreadsheet,
    sheets: Object.freeze(plan.sheets),
    sheetPlans: Object.freeze(Object.keys(plan.sheetPlans).reduce((result, sheetName) => {
      result[sheetName] = Object.freeze(plan.sheetPlans[sheetName]);
      return result;
    }, {})),
    settingAction: plan.settingAction,
    markerAction: plan.markerAction,
    backups: Object.freeze(plan.backups.slice()),
    oldSchemas: plan.oldSchemas
  })));
}

function preflightSpreadsheetV13_(buildingId) {
  const spreadsheet = openSpreadsheet(buildingId);
  const sheetPlans = {};
  Object.keys(SHEET_HEADERS).forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Tab " + sheetName + " fehlt.");
    const classified = readAndClassifyHeaders_(sheet, sheetName);
    assertNoHeaderFormulas_(sheet, classified.headers.length, buildingId, sheetName);
    if (sheetName !== "Bookings" && sheetName !== "Requests" && classified.schema !== "v13") {
      throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Tab " + sheetName + " hat kein gültiges Schema.");
    }
    sheetPlans[sheetName] = { sheet: sheet, headers: classified.headers, schema: classified.schema };
  });
  assertNoDuplicateSettings_(sheetPlans.Settings.sheet, buildingId);
  ["Bookings", "Requests"].forEach((sheetName) => {
    const item = sheetPlans[sheetName];
    if (item.schema === "v12") assertNoFormulasInMigrationRange_(item.sheet, item.headers.length, buildingId, sheetName);
  });
  const settingsRows = readRowsFromSheet_(sheetPlans.Settings.sheet);
  assertNoActiveMaintenanceMarkerV13_(settingsRows, buildingId);
  const settingAction = planPublicDetailsSettingV13_(settingsRows, buildingId);
  const markerAction = planMaintenanceMarkerV13_(settingsRows, buildingId);
  assertNoFormulasInMigrationRange_(sheetPlans.Settings.sheet, SHEET_HEADERS.Settings.length, buildingId, "Settings");
  const backups = planMigrationBackupsV13_(sheetPlans, settingAction, markerAction);
  return {
    buildingId: buildingId,
    spreadsheet: spreadsheet,
    sheets: Object.keys(sheetPlans).reduce((result, sheetName) => { result[sheetName] = sheetPlans[sheetName].sheet; return result; }, {}),
    sheetPlans: sheetPlans,
    settingAction: settingAction,
    markerAction: markerAction,
    backups: backups,
    oldSchemas: "Bookings=" + sheetPlans.Bookings.schema + ", Requests=" + sheetPlans.Requests.schema
  };
}

function planPublicDetailsSettingV13_(settingsRows, buildingId) {
  const current = settingsRows.filter((row) => row.building_id === buildingId);
  if (current.some((row) => row.key === "public_show_booking_details")) return "none";
  return current.some((row) => row.key === "public_show_booking_titles") ? "copyLegacy" : "addFalse";
}

function planMaintenanceMarkerV13_(settingsRows, buildingId) {
  const markers = settingsRows.filter((row) => row.building_id === buildingId && row.key === MAINTENANCE_MARKER_KEY);
  if (markers.length > 1) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Settings enthält einen doppelten Wartungsmarker.");
  return markers.length ? "reuse" : "insert";
}

function planMigrationBackupsV13_(sheetPlans, settingAction, markerAction) {
  const backups = ["Bookings", "Requests"].filter((sheetName) => sheetPlans[sheetName].schema === "v12");
  if (settingAction !== "none" || markerAction === "insert") backups.push("Settings");
  return backups;
}

function assertNoActiveMaintenanceMarkerV13_(settingsRows, buildingId) {
  const markers = settingsRows.filter((row) => row.building_id === buildingId && row.key === MAINTENANCE_MARKER_KEY);
  planMaintenanceMarkerV13_(settingsRows, buildingId);
  if (markers.length && isTruthy(markers[0].value)) {
    throw appError("MAINTENANCE", "Migration abgebrochen: " + buildingId + " / Settings ist noch im Wartungsmodus. Zuerst Wiederherstellung prüfen und den Wartungsmarker manuell auf false setzen.");
  }
}

function backupNameV13_(sheetName, timestamp) {
  return sheetName + "_backup_v13_" + timestamp;
}

function assertBackupSlotsAvailableV13_(plan, timestamp) {
  const slots = {};
  plan.forEach((buildingPlan) => {
    buildingPlan.backups.forEach((sheetName) => {
      const backupName = backupNameV13_(sheetName, timestamp);
      const slot = buildingPlan.spreadsheet.getId() + "\u0000" + backupName;
      if (hasOwn(slots, slot)) throw appError("MIGRATION_ERROR", "Migration abgebrochen: Backup " + backupName + " ist für mehrere Gebäude vorgesehen.");
      if (buildingPlan.spreadsheet.getSheetByName(backupName)) throw appError("MIGRATION_ERROR", "Migration abgebrochen: Backup " + backupName + " existiert bereits.");
      slots[slot] = true;
    });
  });
}

function setMaintenanceMarkersV13_(plan, active) {
  plan.forEach((buildingPlan) => setMaintenanceMarkerV13_(buildingPlan.buildingId, active));
  SpreadsheetApp.flush();
}

function setMaintenanceMarkerV13_(buildingId, active) {
  const sheet = openSpreadsheet(buildingId).getSheetByName("Settings");
  const headers = readAndClassifyHeaders_(sheet, "Settings").headers;
  const buildingColumn = headers.indexOf("building_id") + 1;
  const keyColumn = headers.indexOf("key") + 1;
  const valueColumn = headers.indexOf("value") + 1;
  const values = sheet.getDataRange().getValues();
  const matches = [];
  for (let row = 1; row < values.length; row++) {
    if (String(valueOrEmpty(values[row][buildingColumn - 1])).trim() === buildingId
      && String(valueOrEmpty(values[row][keyColumn - 1])).trim() === MAINTENANCE_MARKER_KEY) matches.push(row + 1);
  }
  if (matches.length > 1) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Settings enthält einen doppelten Wartungsmarker.");
  if (matches.length) {
    sheet.getRange(matches[0], valueColumn).setValue(active);
    return;
  }
  sheet.appendRow(headers.map((header) => {
    if (header === "building_id") return buildingId;
    if (header === "key") return MAINTENANCE_MARKER_KEY;
    if (header === "value") return active;
    return "";
  }));
}

function assertMaintenanceMarkerInactive_(buildingId) {
  const settings = getSettings(buildingId);
  if (isTruthy(settings[MAINTENANCE_MARKER_KEY])) throw appError("MAINTENANCE", "Wartungsarbeiten laufen. Bitte später erneut versuchen.");
}

function assertNoHeaderFormulas_(sheet, width, buildingId, sheetName) {
  const formulas = sheet.getRange(1, 1, 1, width).getFormulas()[0];
  const columnIndex = formulas.findIndex((formula) => formula);
  if (columnIndex !== -1) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / " + sheetName + " enthält eine Formel in Kopfzeile, Spalte " + (columnIndex + 1) + ".");
}

function assertNoDuplicateSettings_(sheet, buildingId) {
  const seen = {};
  readRowsFromSheet_(sheet).forEach((row, index) => {
    const building = String(valueOrEmpty(row.building_id)).trim();
    const key = String(valueOrEmpty(row.key)).trim();
    const valuesPresent = Object.keys(row).some((header) => valueOrEmpty(row[header]) !== "");
    if (valuesPresent && (!building || !key)) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Settings enthält eine unvollständige Zeile " + (index + 2) + ".");
    if (!building && !key) return;
    const compound = building + "\u0000" + key;
    if (hasOwn(seen, compound)) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / Settings enthält einen doppelten Schlüssel " + key + ".");
    seen[compound] = true;
  });
}

function assertNoFormulasInMigrationRange_(sheet, width, buildingId, sheetName) {
  assertNoHeaderFormulas_(sheet, width, buildingId, sheetName);
  const lastRow = sheet.getLastRow();
  for (let start = 2; start <= lastRow; start += MIGRATION_CHUNK_SIZE) {
    const size = Math.min(MIGRATION_CHUNK_SIZE, lastRow - start + 1);
    const formulas = sheet.getRange(start, 1, size, width).getFormulas();
    for (let rowIndex = 0; rowIndex < formulas.length; rowIndex++) {
      const columnIndex = formulas[rowIndex].findIndex((formula) => formula);
      if (columnIndex !== -1) throw appError("SCHEMA_ERROR", "Migration abgebrochen: " + buildingId + " / " + sheetName + " enthält eine Formel in Zeile " + (start + rowIndex) + ", Spalte " + sheet.getRange(1, columnIndex + 1).getValue() + ".");
    }
  }
}

function backupSheetV13_(sheet, timestamp) {
  const backupName = backupNameV13_(sheet.getName(), timestamp);
  const spreadsheet = sheet.getParent();
  if (spreadsheet.getSheetByName(backupName)) throw appError("MIGRATION_ERROR", "Migration abgebrochen: Backup " + backupName + " existiert bereits.");
  sheet.copyTo(spreadsheet).setName(backupName);
  return backupName;
}

function migrateRowsByHeaderV13_(sheet, sourceHeaders, targetHeaders) {
  const lastRow = sheet.getLastRow();
  if (sheet.getMaxColumns() < targetHeaders.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), targetHeaders.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
  for (let start = 2; start <= lastRow; start += MIGRATION_CHUNK_SIZE) {
    const size = Math.min(MIGRATION_CHUNK_SIZE, lastRow - start + 1);
    const values = sheet.getRange(start, 1, size, sourceHeaders.length).getValues();
    const targetValues = values.map((source) => {
      const row = {};
      sourceHeaders.forEach((header, index) => { row[header] = source[index]; });
      return targetHeaders.map((header) => {
        if (header === "public_title_visible" || header === "public_organizer_visible") return false;
        if (header === "public_organizer" || (header === "internal_note" && !hasOwn(row, "internal_note"))) return "";
        return valueOrEmpty(row[header]);
      });
    });
    sheet.getRange(start, 1, size, targetHeaders.length).setValues(targetValues);
  }
  SpreadsheetApp.flush();
  const actual = readHeaderCells_(sheet);
  if (!headersEqual_(actual, targetHeaders) || sheet.getLastRow() !== lastRow) throw appError("MIGRATION_ERROR", "Migration abgebrochen: " + sheet.getName() + " konnte nicht geprüft werden.");
}

function migratePublicDetailsSettingV13_(buildingId) {
  const sheet = openSpreadsheet(buildingId).getSheetByName("Settings");
  const rows = readRowsFromSheet_(sheet);
  const legacy = rows.find((row) => row.building_id === buildingId && row.key === "public_show_booking_titles");
  appendRow(buildingId, "Settings", {
    building_id: buildingId,
    key: "public_show_booking_details",
    value: legacy ? legacy.value : false
  });
}

function applySheetFormattingV13_(sheetName, sheet) {
  const headers = readHeaderCells_(sheet);
  if (!headersEqual_(headers, SHEET_HEADERS[sheetName])) return;
  sheet.setFrozenRows(1);
  const dataRows = Math.max(1, sheet.getLastRow() - 1);
  const column = (header) => headers.indexOf(header) + 1;
  if (column("date")) sheet.getRange(2, column("date"), dataRows, 1).setNumberFormat("yyyy-mm-dd");
  ["from", "to"].forEach((header) => { if (column(header)) sheet.getRange(2, column(header), dataRows, 1).setNumberFormat("hh:mm"); });
  ["public_title", "public_organizer", "note", "internal_note"].forEach((header) => {
    if (column(header)) sheet.getRange(2, column(header), dataRows, 1).setWrap(true);
  });
  ["public_title_visible", "public_organizer_visible"].forEach((header) => {
    if (!column(header)) return;
    repairVisibilityValuesV13_(sheet, column(header), sheet.getLastRow() - 1);
    const validation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(2, column(header), Math.max(500, dataRows), 1).setDataValidation(validation);
  });
}

function repairVisibilityValuesV13_(sheet, column, dataRows) {
  if (dataRows < 1) return;
  for (let start = 2; start <= dataRows + 1; start += MIGRATION_CHUNK_SIZE) {
    const size = Math.min(MIGRATION_CHUNK_SIZE, dataRows + 2 - start);
    const values = sheet.getRange(start, column, size, 1).getValues();
    if (!values.some((row) => typeof row[0] !== "boolean")) continue;
    sheet.getRange(start, column, size, 1).setValues(values.map((row) => [typeof row[0] === "boolean" ? row[0] : false]));
  }
}

function logMigrationResultV13_(buildingId, message) {
  logAction(buildingId, "migrateSheetsV13", "", message);
}

function readRowsFromSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    const item = {};
    headers.forEach((header, index) => { item[header] = formatCell(row[index], header); });
    return item;
  });
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
  const targetHeaders = SHEET_HEADERS[sheetName];
  if (!targetHeaders) throw appError("SCHEMA_ERROR", "Unbekannter Tab: " + sheetName);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
  const headers = readAndClassifyHeaders_(sheet, sheetName).headers;
  sheet.appendRow(headers.map((header) => valueOrEmpty(data[header])));
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
  const settings = {};
  readRows(buildingId, "Settings").filter((row) => row.building_id === buildingId).forEach((row) => {
    if ((row.key === "public_show_booking_details" || row.key === "public_show_booking_titles" || row.key === MAINTENANCE_MARKER_KEY) && hasOwn(settings, row.key)) {
      throw appError("SCHEMA_ERROR", "Settings enthält einen doppelten Sicherheits-Master.");
    }
    settings[row.key] = row.value;
  });
  return settings;
}

function publicBookingDetailsEnabled(settings) {
  if (hasOwn(settings, "public_show_booking_details")) return isTruthy(settings.public_show_booking_details);
  return isTruthy(settings.public_show_booking_titles);
}

function publicOccupancyRow(row, showDetails) {
  const publicTitle = normalizePublicMarkdown(row.public_title);
  const publicOrganizer = normalizePublicMarkdown(row.public_organizer);
  return {
    date: row.date,
    from: normalizeTime(row.from),
    to: normalizeTime(row.to),
    allDay: isAllDay(row.from, row.to),
    status: STATUS_LABELS[row.status] || row.status,
    statusKey: row.status,
    publicTitle: showDetails && isTruthy(row.public_title_visible) && publicTitle.trim() ? publicTitle : "",
    publicOrganizer: showDetails && isTruthy(row.public_organizer_visible) && publicOrganizer.trim() ? publicOrganizer : ""
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

function normalizePublicMarkdown(value) {
  return String(valueOrEmpty(value))
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .slice(0, 1000);
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? "" : value;
}

function formatCell(value, header) {
  if (value instanceof Date && ["date", "valid_from", "valid_until"].includes(header)) return formatDate(value);
  if (value instanceof Date && ["from", "to"].includes(header)) return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value;
  return String(valueOrEmpty(value)).trim();
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function isTruthy(value) {
  return ["true", "ja", "1", "yes"].includes(String(value).toLowerCase());
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
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
