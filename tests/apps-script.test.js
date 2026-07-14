"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function createSheet(headers, rows, name = "Test") {
  const state = { headers: headers.slice(), rows: rows.map((row) => row.slice()), appended: [] };
  const sheet = {
    state,
    getName: () => name,
    getLastRow: () => state.rows.length + 1,
    getLastColumn: () => state.headers.length,
    getMaxColumns: () => Math.max(26, state.headers.length),
    insertColumnsAfter: () => {},
    getDataRange: () => ({ getValues: () => [state.headers].concat(state.rows) }),
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues() {
          const source = row === 1 ? [state.headers].concat(state.rows) : state.rows;
          const start = row === 1 ? 0 : row - 2;
          return source.slice(start, start + height).map((line) => line.slice(column - 1, column - 1 + width));
        },
        setValues(values) {
          if (row === 1 && column === 1) {
            state.headers = values[0].slice();
            return;
          }
          values.forEach((line, index) => {
            const target = state.rows[row - 2 + index] || [];
            line.forEach((value, offset) => { target[column - 1 + offset] = value; });
            state.rows[row - 2 + index] = target;
          });
        },
        setValue(value) {
          const target = state.rows[row - 2] || [];
          target[column - 1] = value;
          state.rows[row - 2] = target;
        },
        getFormulas: () => Array.from({ length: height }, () => Array(width).fill("")),
        getValue: () => state.headers[column - 1],
        setNumberFormat: () => {},
        setWrap: () => {},
        setDataValidation: () => {}
      };
    },
    setFrozenRows: () => {},
    appendRow(row) { state.appended.push(row); state.rows.push(row); }
  };
  return sheet;
}

function loadApi(sheetsByName) {
  const source = fs.readFileSync(path.join(root, "apps-script", "buchungs-api", "Code.gs"), "utf8")
    + "\nthis.__test = { SHEET_HEADERS, LEGACY_SHEET_HEADERS_V12, headersEqual_, readAndClassifyHeaders_, assertExactHeaders_, applySetupSpreadsheet_, publicBookingDetailsEnabled, publicOccupancyRow, normalizePublicMarkdown, formatCell, appendRow, migrateRowsByHeaderV13_, planPublicDetailsSettingV13_, planMaintenanceMarkerV13_, planMigrationBackupsV13_, assertNoActiveMaintenanceMarkerV13_, backupNameV13_, assertBackupSlotsAvailableV13_, setMaintenanceMarkerV13_, assertMaintenanceMarkerInactive_, applySheetFormattingV13_, getOccupancy, getSettings };";
  const spreadsheet = { getId: () => "mock-spreadsheet", getUrl: () => "https://example.test/sheet", getSheets: () => Object.values(sheetsByName), getSheetByName: (name) => sheetsByName[name], insertSheet: (name) => {
    const sheet = createSheet([], []);
    sheetsByName[name] = sheet;
    return sheet;
  } };
  const context = {
    console,
    Date,
    Set,
    JSON,
    Object,
    String,
    Number,
    Array,
    Math,
    Utilities: { formatDate: () => "2026-07-14", getUuid: () => "uuid" },
    Session: { getScriptTimeZone: () => "UTC" },
    SpreadsheetApp: {
      openById: () => spreadsheet,
      flush: () => {},
      newDataValidation: () => ({ requireCheckbox() { return this; }, build: () => ({}) })
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: { sendEmail: () => {} },
    ContentService: { MimeType: { JSON: "JSON" }, createTextOutput: () => ({ setMimeType() { return this; } }) }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "Code.gs" });
  context.__test.spreadsheet = spreadsheet;
  return context.__test;
}

const targetBookings = ["booking_id", "building_id", "date", "from", "to", "title", "status", "public_title", "public_title_visible", "public_organizer", "public_organizer_visible", "created_at", "updated_at", "internal_note"];
const targetRequests = ["request_id", "building_id", "date", "from", "to", "requester_name", "requester_contact", "title", "note", "status", "conflict", "created_at", "updated_at", "internal_note"];
const api = loadApi({});

const setupApi = loadApi(Object.fromEntries(Object.entries(api.SHEET_HEADERS).map(([name, headers]) => [name, createSheet(headers, [], name)])));
setupApi.applySetupSpreadsheet_({ buildingId: "dgh_rb", spreadsheet: setupApi.spreadsheet });
const setupSettings = setupApi.spreadsheet.getSheetByName("Settings").state.rows;
assert.equal(setupSettings.find((row) => row[1] === "sheet_url")[2], "https://example.test/sheet");

assert.equal(api.publicBookingDetailsEnabled({ public_show_booking_details: true, public_show_booking_titles: false }), true);
assert.equal(api.publicBookingDetailsEnabled({ public_show_booking_details: "", public_show_booking_titles: true }), false);
assert.equal(api.publicBookingDetailsEnabled({ public_show_booking_titles: "true" }), true);
assert.equal(api.publicBookingDetailsEnabled({}), false);

const privateRow = {
  booking_id: "SECRET-ID", building_id: "SECRET-BUILDING", date: "2026-07-14", from: "18:00", to: "22:00",
  title: "SECRET-TITLE", status: "confirmed", public_title: "Öffentlich\r\nTitel", public_title_visible: true,
  public_organizer: "Verein ß", public_organizer_visible: true, internal_note: "SECRET-NOTE",
  requester_name: "SECRET-NAME", requester_contact: "SECRET-CONTACT", note: "SECRET-REQUEST"
};
const publicRow = api.publicOccupancyRow(privateRow, true);
assert.deepEqual(Object.keys(publicRow).sort(), ["allDay", "date", "from", "publicOrganizer", "publicTitle", "status", "statusKey", "to"].sort());
assert.equal(publicRow.publicTitle, "Öffentlich\nTitel");
assert.equal(publicRow.publicOrganizer, "Verein ß");
const serialized = JSON.stringify(publicRow);
["SECRET-ID", "SECRET-BUILDING", "SECRET-TITLE", "SECRET-NOTE", "SECRET-NAME", "SECRET-CONTACT", "SECRET-REQUEST"].forEach((marker) => assert.equal(serialized.includes(marker), false));
assert.equal(api.publicOccupancyRow({ ...privateRow, public_title_visible: false }, true).publicTitle, "");
assert.equal(api.publicOccupancyRow({ ...privateRow, public_organizer_visible: false }, true).publicOrganizer, "");
assert.equal(api.publicOccupancyRow({ ...privateRow, public_title: "   " }, true).publicTitle, "");
assert.equal(api.publicOccupancyRow(privateRow, false).publicOrganizer, "");

assert.equal(api.normalizePublicMarkdown("A\r\nB\rC\nD\u0000\tÖß"), "A\nB\nC\nDÖß");
assert.equal(api.normalizePublicMarkdown("x".repeat(1001)).length, 1000);
assert.equal(api.formatCell(false, "public_title_visible"), false);

assert.equal(api.headersEqual_(targetBookings, api.SHEET_HEADERS.Bookings), true);
assert.equal(api.readAndClassifyHeaders_(createSheet(api.LEGACY_SHEET_HEADERS_V12.Bookings, []), "Bookings").schema, "v12");
assert.equal(api.readAndClassifyHeaders_(createSheet(targetRequests, []), "Requests").schema, "v13");
assert.throws(() => api.assertExactHeaders_(["building_id", "building_id"], [api.SHEET_HEADERS.Settings], "Settings"), /Schemafehler/);
assert.equal(api.planPublicDetailsSettingV13_([{ building_id: "dgh_rb", key: "public_show_booking_details", value: "" }], "dgh_rb"), "none");
assert.equal(api.planPublicDetailsSettingV13_([{ building_id: "dgh_rb", key: "public_show_booking_titles", value: true }], "dgh_rb"), "copyLegacy");
assert.equal(api.planPublicDetailsSettingV13_([], "dgh_rb"), "addFalse");
assert.equal(api.planMaintenanceMarkerV13_([], "dgh_rb"), "insert");
assert.equal(api.planMaintenanceMarkerV13_([{ building_id: "dgh_rb", key: "maintenance_migrate_sheets_v13", value: false }], "dgh_rb"), "reuse");
const targetSheetPlans = { Bookings: { schema: "v13" }, Requests: { schema: "v13" } };
assert.deepEqual(Array.from(api.planMigrationBackupsV13_(targetSheetPlans, "none", "insert")), ["Settings"]);
assert.deepEqual(Array.from(api.planMigrationBackupsV13_(targetSheetPlans, "none", "reuse")), []);
assert.throws(() => api.assertNoActiveMaintenanceMarkerV13_([{ building_id: "dgh_rb", key: "maintenance_migrate_sheets_v13", value: true }], "dgh_rb"), /Wartungsmodus/);
assert.doesNotThrow(() => api.assertNoActiveMaintenanceMarkerV13_([{ building_id: "dgh_rb", key: "maintenance_migrate_sheets_v13", value: false }], "dgh_rb"));
const availableBackupSpreadsheet = { getId: () => "one", getSheetByName: () => null };
assert.doesNotThrow(() => api.assertBackupSlotsAvailableV13_([{ spreadsheet: availableBackupSpreadsheet, backups: ["Bookings", "Settings"] }], "20260714_100000"));
assert.throws(() => api.assertBackupSlotsAvailableV13_([{ spreadsheet: { getId: () => "one", getSheetByName: () => ({}) }, backups: ["Bookings"] }], "20260714_100000"), /existiert bereits/);
assert.throws(() => api.assertBackupSlotsAvailableV13_([
  { spreadsheet: availableBackupSpreadsheet, backups: ["Bookings"] },
  { spreadsheet: availableBackupSpreadsheet, backups: ["Bookings"] }
], "20260714_100000"), /mehrere Gebäude/);

const appendSheet = createSheet(targetBookings, []);
const appendApi = loadApi({ Bookings: appendSheet });
appendApi.appendRow("dgh_rb", "Bookings", { booking_id: "one", public_title_visible: false, public_organizer_visible: false });
assert.equal(appendSheet.state.appended[0][8], false);
assert.equal(appendSheet.state.appended[0][10], false);

const legacyRows = [["booking-1", "dgh_rb", "2026-07-14", "10:00", "12:00", "intern", "confirmed", "öffentlich", "INTERNE NOTIZ", "created", "updated"]];
const migrationSheet = createSheet(api.LEGACY_SHEET_HEADERS_V12.Bookings, legacyRows);
api.migrateRowsByHeaderV13_(migrationSheet, api.LEGACY_SHEET_HEADERS_V12.Bookings, targetBookings);
assert.deepEqual(migrationSheet.state.headers, targetBookings);
assert.equal(migrationSheet.state.rows[0][8], false);
assert.equal(migrationSheet.state.rows[0][9], "");
assert.equal(migrationSheet.state.rows[0][10], false);
assert.equal(migrationSheet.state.rows[0][13], "INTERNE NOTIZ");

const repairRows = [
  ["one", "dgh_rb", "2026-07-14", "10:00", "12:00", "", "confirmed", "", true, "", false, "", "", ""],
  ["two", "dgh_rb", "2026-07-15", "10:00", "12:00", "", "confirmed", "", "true", "", "", "", "", ""],
  ["three", "dgh_rb", "2026-07-16", "10:00", "12:00", "", "confirmed", "", 1, "", "x", "", "", ""]
];
const repairSheet = createSheet(targetBookings, repairRows);
api.applySheetFormattingV13_("Bookings", repairSheet);
assert.equal(repairSheet.state.rows[0][8], true);
assert.equal(repairSheet.state.rows[0][10], false);
assert.equal(repairSheet.state.rows[1][8], false);
assert.equal(repairSheet.state.rows[1][10], false);
assert.equal(repairSheet.state.rows[2][8], false);
assert.equal(repairSheet.state.rows[2][10], false);

const markerSettings = createSheet(api.SHEET_HEADERS.Settings, [["dgh_rb", "notify_email", "kontakt@example.com"]], "Settings");
const markerApi = loadApi({ Settings: markerSettings });
markerApi.setMaintenanceMarkerV13_("dgh_rb", true);
assert.throws(() => markerApi.assertMaintenanceMarkerInactive_("dgh_rb"), /Wartungsarbeiten/);
markerApi.setMaintenanceMarkerV13_("dgh_rb", false);
assert.doesNotThrow(() => markerApi.assertMaintenanceMarkerInactive_("dgh_rb"));

const occupancySheets = {
  Buildings: createSheet(api.SHEET_HEADERS.Buildings, [["dgh_rb", "DGH", "", "", true, ""]]),
  Bookings: createSheet(targetBookings, [["id", "dgh_rb", "2026-07-14", "18:00", "22:00", "PRIVATE", "confirmed", "Freigegeben", true, "Veranstalter", true, "", "", "SECRET"]]),
  Settings: createSheet(api.SHEET_HEADERS.Settings, [["dgh_rb", "public_show_booking_details", true]])
};
const occupancyApi = loadApi(occupancySheets);
const payload = occupancyApi.getOccupancy("dgh_rb", "2026-01-01", "2027-01-01");
assert.equal(payload.schemaVersion, 2);
assert.equal(payload.items[0].publicTitle, "Freigegeben");
assert.equal(payload.items[0].publicOrganizer, "Veranstalter");
occupancySheets.Settings.state.rows.push(["dgh_rb", "public_show_booking_details", true]);
assert.throws(() => occupancyApi.getSettings("dgh_rb"), /doppelten Sicherheits-Master/);

const managementSource = fs.readFileSync(path.join(root, "apps-script", "buchungsverwaltung", "Code.gs"), "utf8")
  + "\nthis.__test = { formatCell_, valueOrEmpty_, assertRequiredHeaders_, assertMaintenanceMarkerInactive_, appendRow_ };";
const managementSheet = createSheet(targetBookings, []);
const managementBuildings = createSheet(api.SHEET_HEADERS.Buildings, [["dgh_rb", "DGH", "", "", true, ""]], "Buildings");
const managementSettings = createSheet(api.SHEET_HEADERS.Settings, [["dgh_rb", "maintenance_migrate_sheets_v13", true]], "Settings");
const managementSheets = { Bookings: managementSheet, Buildings: managementBuildings, Settings: managementSettings };
const managementContext = {
  Date,
  String,
  Utilities: { formatDate: () => "" },
  Session: { getScriptTimeZone: () => "UTC" },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (name) => managementSheets[name] }) }
};
vm.createContext(managementContext);
vm.runInContext(managementSource, managementContext, { filename: "buchungsverwaltung/Code.gs" });
assert.equal(managementContext.__test.formatCell_(false, "public_title_visible"), false);
assert.equal(managementContext.__test.valueOrEmpty_(false), false);
managementContext.__test.assertRequiredHeaders_("Bookings");
managementSheet.state.headers = targetBookings.filter((header) => header !== "public_organizer_visible");
assert.throws(() => managementContext.__test.assertRequiredHeaders_("Bookings"), /Fehlende Spalten: public_organizer_visible/);
managementSheet.state.headers = targetBookings.slice();
assert.throws(() => managementContext.__test.assertMaintenanceMarkerInactive_(), /Mutationen sind bis zur manuellen Freigabe gesperrt/);
assert.throws(() => managementContext.__test.appendRow_("Bookings", { booking_id: "blocked" }), /Mutationen sind bis zur manuellen Freigabe gesperrt/);
managementSettings.state.rows[0][2] = false;
assert.doesNotThrow(() => managementContext.__test.assertMaintenanceMarkerInactive_());

const trailingPrevalidatedRows = Array.from({ length: 500 }, () => Array(targetBookings.length).fill(false));
trailingPrevalidatedRows[0] = ["existing", "dgh_rb", "2026-07-14", "10:00", "12:00", "", "confirmed", "", false, "", false, "", "", ""];
managementSheet.state.rows = trailingPrevalidatedRows;
managementContext.__test.appendRow_("Bookings", { booking_id: "after-existing", public_title_visible: false, public_organizer_visible: false });
assert.equal(managementSheet.state.rows[0][0], "existing");
assert.equal(managementSheet.state.rows[1][0], "after-existing");
assert.equal(managementSheet.state.rows[1][8], false);
assert.equal(managementSheet.state.rows[1][10], false);
assert.equal(managementSheet.state.appended.length, 0);

managementSheet.state.rows = Array.from({ length: 500 }, () => Array(targetBookings.length).fill(false));
managementContext.__test.appendRow_("Bookings", { booking_id: "physical-row-two" });
assert.equal(managementSheet.state.rows[0][0], "physical-row-two");

console.log("apps-script.test.js: OK");
