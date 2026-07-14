/**
 * Buchungsverwaltung – gebundenes Google-Apps-Script - V1.3.1
 * =======================================================
 *
 * Dieses Script gehört direkt in das Gebäude-Spreadsheet
 * (Erweiterungen → Apps Script). Es erzeugt das Menü "Buchungen"
 * für den Betreiber-Workflow.
 *
 * Einrichtung:
 *   1. Spreadsheet öffnen → Erweiterungen → Apps Script
 *   2. Vorhandenen Code löschen, diesen hier einfügen und speichern
 *   3. Bei erster Menü-Nutzung: Berechtigungen erteilen
 *   4. Spreadsheet neu laden → Menü "Buchungen" erscheint
 *
 * Voraussetzung: Spreadsheet wurde via setupSheets() aus der
 * Buchungs-API initialisiert. Tabs Buildings, Bookings, Requests,
 * Settings, Log sind vorhanden.
 */

// ═══════════════════════════════════════════════════════════════════
// Menü – erscheint automatisch beim Öffnen des Spreadsheets
// ═══════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Buchungen')
    .addItem('Anfrage bestätigen → Booking', 'approveSelectedRequest')
    .addItem('Anfrage ablehnen', 'rejectSelectedRequest')
    .addSeparator()
    .addItem('Zeitraum sperren', 'blockTimeRange')
    .addSeparator()
    .addItem('Hilfe', 'showHelp')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════
// Aktionen – werden aus dem Menü heraus aufgerufen
// ═══════════════════════════════════════════════════════════════════

const REQUIRED_HEADERS_ = {
  Bookings: ['booking_id', 'building_id', 'date', 'from', 'to', 'title', 'status', 'public_title', 'public_title_visible', 'public_organizer', 'public_organizer_visible', 'created_at', 'updated_at', 'internal_note'],
  Requests: ['request_id', 'building_id', 'date', 'from', 'to', 'requester_name', 'requester_contact', 'title', 'note', 'status', 'conflict', 'created_at', 'updated_at', 'internal_note'],
  Buildings: ['building_id', 'name', 'operator_name', 'contact_email', 'active', 'public_note'],
  Settings: ['building_id', 'key', 'value'],
  Log: ['timestamp', 'building_id', 'action', 'reference_id', 'message']
};
const MAINTENANCE_MARKER_KEY_ = 'maintenance_migrate_sheets_v13';

/**
 * Ausgewählte Zeile in Requests bestätigen:
 *   - Booking in Bookings anlegen (status = confirmed)
 *   - Request-Status auf approved setzen
 *   - Bestätigungs-E-Mail an den Anfragenden
 */
function approveSelectedRequest() {
  const ui = SpreadsheetApp.getUi();
  try {
    assertManagementSchemas_();
    const record = getActiveRecord_();
    if (!record || record.sheetName !== 'Requests') {
      ui.alert('Bitte eine Zeile im Tab "Requests" auswählen.');
      return;
    }

    const data = record.data;
    if (data.status !== 'open' && data.status !== 'open_with_conflict') {
      ui.alert(
        'Nicht möglich',
        'Die Anfrage hat Status "' + data.status + '".\n'
        + 'Nur offene Anfragen (open / open_with_conflict) können bestätigt werden.',
        ui.ButtonSet.OK);
      return;
    }

    const conflict = checkConflict_(data.date, data.from, data.to);
    if (conflict) {
      const response = ui.alert(
        'Konflikt erkannt',
        'Am ' + data.date + ' existiert bereits eine Buchung oder Sperrung\n'
        + 'im Zeitraum ' + data.from + ' – ' + data.to + '.\n\n'
        + 'Trotzdem bestätigen?',
        ui.ButtonSet.YES_NO);
      if (response !== ui.Button.YES) return;
    }
    const approvedConflict = conflict;

    const summary = 'Datum:   ' + data.date + '\n'
      + 'Zeit:    ' + data.from + ' – ' + data.to + '\n'
      + 'Name:    ' + data.requester_name + '\n'
      + 'Kontakt: ' + data.requester_contact + '\n'
      + 'Zweck:   ' + data.title + '\n'
      + 'Notiz:   ' + (data.note || '–');

    const confirm = ui.alert(
      'Anfrage bestätigen?',
      summary + '\n\nDie Anfrage wird als Booking übernommen.\n'
      + 'Der Anfragende erhält eine Bestätigungs-E-Mail.',
      ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {
      assertManagementSchemas_();
      const current = getActiveRecord_();
      if (!current || current.sheetName !== 'Requests' || current.data.request_id !== data.request_id
        || (current.data.status !== 'open' && current.data.status !== 'open_with_conflict')) {
        throw new Error('Die ausgewählte Anfrage wurde zwischenzeitlich geändert. Bitte erneut prüfen.');
      }
      if (checkConflict_(current.data.date, current.data.from, current.data.to) && !approvedConflict) {
        throw new Error('Die Anfrage kollidiert inzwischen mit einer Buchung oder Sperrung. Bitte erneut prüfen.');
      }
      const buildingId = getBuildingId_();
      const now = new Date().toISOString();
      const bookingId = Utilities.getUuid();
      appendRow_('Bookings', {
        booking_id: bookingId,
        building_id: buildingId,
        date: current.data.date,
        from: current.data.from,
        to: current.data.to,
        title: current.data.title,
        status: 'confirmed',
        public_title: '',
        public_title_visible: false,
        public_organizer: '',
        public_organizer_visible: false,
        created_at: now,
        updated_at: now,
        internal_note: current.data.internal_note || ''
      });
      updateRow_('Requests', current.data._row, { status: 'approved', updated_at: now });
      SpreadsheetApp.flush();
      try { sendApprovalEmail_(buildingId, current.data); } catch (error) { console.log('Bestätigung gespeichert, E-Mail fehlgeschlagen: ' + error.message); }
      try { logAction_(buildingId, 'approveRequest', bookingId, 'Anfrage ' + current.data.request_id + ' bestätigt → Booking ' + bookingId); } catch (error) { console.log('Bestätigung gespeichert, Protokollierung fehlgeschlagen: ' + error.message); }
    } finally {
      lock.releaseLock();
    }

    ui.alert('✓ Bestätigt',
      'Die Anfrage wurde als Booking übernommen.\n'
      + 'Der Anfragende erhält eine Bestätigungs-E-Mail.',
      ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Fehler', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Ausgewählte Zeile in Requests ablehnen:
 *   - Request-Status auf rejected setzen
 *   - Optionale Ablehnungs-E-Mail an den Anfragenden
 */
function rejectSelectedRequest() {
  const ui = SpreadsheetApp.getUi();
  try {
    assertManagementSchemas_();
    const record = getActiveRecord_();
    if (!record || record.sheetName !== 'Requests') {
      ui.alert('Bitte eine Zeile im Tab "Requests" auswählen.');
      return;
    }

    const data = record.data;
    if (data.status !== 'open' && data.status !== 'open_with_conflict') {
      ui.alert(
        'Nicht möglich',
        'Nur offene Anfragen (open / open_with_conflict) können abgelehnt werden.\n'
        + 'Aktueller Status: ' + data.status,
        ui.ButtonSet.OK);
      return;
    }

    const reason = ui.prompt(
      'Anfrage ablehnen',
      'Grund für die Ablehnung (optional):',
      ui.ButtonSet.OK_CANCEL);
    if (reason.getSelectedButton() !== ui.Button.OK) return;

    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {
      assertManagementSchemas_();
      const current = getActiveRecord_();
      if (!current || current.sheetName !== 'Requests' || current.data.request_id !== data.request_id
        || (current.data.status !== 'open' && current.data.status !== 'open_with_conflict')) {
        throw new Error('Die ausgewählte Anfrage wurde zwischenzeitlich geändert. Bitte erneut prüfen.');
      }
      const buildingId = getBuildingId_();
      const now = new Date().toISOString();
      updateRow_('Requests', current.data._row, { status: 'rejected', updated_at: now });
      SpreadsheetApp.flush();
      try { sendRejectionEmail_(buildingId, current.data, reason.getResponseText()); } catch (error) { console.log('Ablehnung gespeichert, E-Mail fehlgeschlagen: ' + error.message); }
      try { logAction_(buildingId, 'rejectRequest', current.data.request_id, 'Anfrage ' + current.data.request_id + ' abgelehnt'); } catch (error) { console.log('Ablehnung gespeichert, Protokollierung fehlgeschlagen: ' + error.message); }
    } finally {
      lock.releaseLock();
    }

    ui.alert('✓ Abgelehnt',
      'Die Anfrage wurde abgelehnt.',
      ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Fehler', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Zeitraum im Bookings-Tab als gesperrt eintragen (status = blocked).
 * Öffnet ein Dialogfenster zur Eingabe von Datum, Zeiten und Grund.
 */
function blockTimeRange() {
  const html = []
    .concat('<style>')
    .concat('body{font-family:system-ui,sans-serif;padding:20px}')
    .concat('label{display:block;margin-bottom:12px;font-size:14px;font-weight:500}')
    .concat('input,textarea{display:block;width:100%;margin-top:4px;padding:7px;')
    .concat('border:1px solid #ccc;border-radius:4px;box-sizing:border-box}')
    .concat('textarea{resize:vertical}')
    .concat('button{margin-top:16px;padding:8px 24px;background:#1a73e8;color:#fff;')
    .concat('border:none;border-radius:4px;cursor:pointer;font-size:14px}')
    .concat('button:hover{background:#1557b0}')
    .concat('</style>')
    .concat('<form id="f">')
    .concat('<label>Datum<input type="date" name="date" required></label>')
    .concat('<label>Von<input type="time" name="from" value="00:00" required></label>')
    .concat('<label>Bis<input type="time" name="to" value="23:59" required></label>')
    .concat('<label>Grund / Bezeichnung<input type="text" name="title"')
    .concat(' placeholder="z. B. Wartungsarbeiten" required></label>')
    .concat('<label>Interner Vermerk<textarea name="note" rows="2"></textarea></label>')
    .concat('<button type="submit">Sperrung eintragen</button>')
    .concat('</form>')
    .concat('<script>')
    .concat('document.getElementById("f").addEventListener("submit",function(e){')
    .concat('e.preventDefault();')
    .concat('var d=Object.fromEntries(new FormData(this));')
    .concat('google.script.run')
    .concat('.withSuccessHandler(function(m){alert(m);google.script.host.close();})')
    .concat('.withFailureHandler(function(m){alert("Fehler: "+m);})')
    .concat('.confirmBlock(d);')
    .concat('});')
    .concat('</script>')
    .join('');

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(420),
    'Zeitraum sperren');
}

/**
 * Wird vom Dialog blockTimeRange() aufgerufen.
 * Validiert und trägt die Sperrzeit in Bookings ein.
 */
function confirmBlock(data) {
  if (!data.date || !data.from || !data.to || !data.title) {
    throw new Error('Bitte alle Pflichtfelder ausfüllen.');
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    assertManagementSchemas_();
    const buildingId = getBuildingId_();
    const now = new Date().toISOString();
    const bookingId = Utilities.getUuid();
    const conflict = checkConflict_(data.date, data.from, data.to);
    if (conflict) {
      throw new Error('Am ' + data.date + ' besteht bereits eine Buchung oder Sperrung\n'
        + 'im Zeitraum ' + data.from + ' – ' + data.to + '.');
    }
    appendRow_('Bookings', {
      booking_id: bookingId,
      building_id: buildingId,
      date: data.date,
      from: data.from,
      to: data.to,
      title: data.title,
      status: 'blocked',
      public_title: '',
      public_title_visible: false,
      public_organizer: '',
      public_organizer_visible: false,
      internal_note: data.note || '',
      created_at: now,
      updated_at: now
    });
    SpreadsheetApp.flush();
    try { logAction_(buildingId, 'blockTimeRange', bookingId, 'Sperrzeit ' + data.date + ' ' + data.from + '–' + data.to + ' (' + data.title + ')'); } catch (error) { console.log('Sperrung gespeichert, Protokollierung fehlgeschlagen: ' + error.message); }
  } finally {
    lock.releaseLock();
  }

  return '✓ Sperrzeit eingetragen:\n'
    + data.date + ', ' + data.from + ' – ' + data.to + '\n'
    + data.title;
}

/**
 * Kurzanleitung für den Betreiber.
 */
function showHelp() {
  SpreadsheetApp.getUi().alert(
    'Buchungsverwaltung – Hilfe',
    'Anfrage bestätigen:\n'
    + '  1. Tab "Requests" öffnen\n'
    + '  2. Gewünschte Zeile anklicken\n'
    + '  3. Menü → Buchungen → "Anfrage bestätigen → Booking"\n'
    + '  → Booking wird angelegt, E-Mail an Anfragenden gesendet\n\n'
    + 'Anfrage ablehnen:\n'
    + '  1. Zeile in "Requests" auswählen\n'
    + '  2. Menü → "Anfrage ablehnen"\n'
    + '  3. Optional Grund eingeben\n'
    + '  → Anfragender erhält E-Mail mit Begründung\n\n'
    + 'Zeitraum sperren:\n'
    + '  1. Menü → "Zeitraum sperren"\n'
    + '  2. Datum, Zeiten, Grund eingeben\n'
    + '  → Wartungs-/Schließtage eintragen\n\n'
     + 'Hinweise:\n'
    + '  • Alle Aktionen werden im Tab "Log" dokumentiert\n'
    + '  • Bei Konflikten warnt das Script vor dem Bestätigen\n'
     + '  • Öffentliche Details werden nur direkt im Tab "Bookings" gepflegt:\n'
     + '    public_title und public_organizer sowie beide Sichtbarkeits-Checkboxen.\n'
     + '    Text allein veröffentlicht nichts; zusätzlich muss der Master\n'
     + '    public_show_booking_details im Tab "Settings" aktiv sein.\n'
     + '  • Namen und mailto:-Adressen nur nach bewusster öffentlicher Freigabe eintragen.\n'
     + '  • Bei Rückfragen: Betreiber-E-Mail aus Settings-Tab',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ═══════════════════════════════════════════════════════════════════
// Hilfsfunktionen – lesen/schreiben Daten im aktiven Spreadsheet
// ═══════════════════════════════════════════════════════════════════

function assertManagementSchemas_() {
  Object.keys(REQUIRED_HEADERS_).forEach(assertRequiredHeaders_);
  assertMaintenanceMarkerInactive_();
}

function assertMaintenanceMarkerInactive_() {
  const buildingId = getBuildingId_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const buildingColumn = headers.indexOf('building_id');
  const keyColumn = headers.indexOf('key');
  const valueColumn = headers.indexOf('value');
  const markers = [];
  for (let row = 1; row < data.length; row++) {
    if (String(data[row][buildingColumn] || '').trim() === buildingId
      && String(data[row][keyColumn] || '').trim() === MAINTENANCE_MARKER_KEY_) markers.push(data[row][valueColumn]);
  }
  if (markers.length > 1) throw new Error('Wartungsmarker ist doppelt vorhanden. Mutationen sind gesperrt.');
  if (markers.length && isTruthy_(markers[0])) throw new Error('Wartungsarbeiten laufen. Mutationen sind bis zur manuellen Freigabe gesperrt.');
}

function assertRequiredHeaders_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Tab "' + sheetName + '" nicht gefunden.');
  if (sheet.getLastRow() < 1) throw new Error('Tab "' + sheetName + '" hat nicht das Schema von Version 1.3. Fehlende Spalten: ' + REQUIRED_HEADERS_[sheetName].join(', ') + '.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const expected = REQUIRED_HEADERS_[sheetName];
  const missing = expected.filter((header) => headers.indexOf(header) === -1);
  const duplicate = headers.some((header, index) => headers.indexOf(header) !== index);
  const exact = headers.length === expected.length && headers.every((header, index) => header === expected[index]);
  if (missing.length) throw new Error('Tab "' + sheetName + '" hat nicht das Schema von Version 1.3. Fehlende Spalten: ' + missing.join(', ') + '.');
  if (duplicate || !exact) throw new Error('Tab "' + sheetName + '" hat nicht das exakte Schema von Version 1.3.');
}

/**
 * Liefert die aktuell ausgewählte Zeile als Datenobjekt.
 * Erwartet: Header in Zeile 1, Daten ab Zeile 2.
 */
function getActiveRecord_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) return null;

  const row = range.getRow();
  if (row < 2) return null;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(String);
  const values = sheet.getRange(row, 1, 1, headers.length)
    .getValues()[0];

  const data = { _row: row };
  headers.forEach((h, i) => { data[h] = formatCell_(values[i], h); });
  return { sheetName: sheet.getName(), row, data };
}

/**
 * Ermittelt die building_id des aktiven Spreadsheets
 * aus dem ersten aktiven Eintrag im Buildings-Tab.
 */
function getBuildingId_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Buildings');
  if (!sheet) throw new Error('Tab "Buildings" nicht gefunden.');

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('Tab "Buildings" ist leer.');

  const headers = data[0].map(String);
  const idIdx = headers.indexOf('building_id');
  const activeIdx = headers.indexOf('active');
  if (idIdx === -1 || activeIdx === -1) {
    throw new Error('Spalten building_id oder active in Buildings nicht gefunden.');
  }

  for (let i = 1; i < data.length; i++) {
    if (isTruthy_(data[i][activeIdx])) return String(data[i][idIdx]).trim();
  }
  throw new Error('Kein aktives Gebäude in Buildings gefunden.');
}

/**
 * Prüft, ob ein Zeitraum mit bestehenden confirmed/blocked-Einträgen
 * im Bookings-Tab kollidiert.
 */
function checkConflict_(date, from, to) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Bookings');
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;

  const headers = data[0].map(String);
  const dateIdx = headers.indexOf('date');
  const fromIdx = headers.indexOf('from');
  const toIdx = headers.indexOf('to');
  const statusIdx = headers.indexOf('status');
  if ([dateIdx, fromIdx, toIdx, statusIdx].includes(-1)) return false;

  const newStart = toMinutes_(from);
  const newEnd = toMinutes_(to);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[statusIdx] || '').trim();
    if (status !== 'confirmed' && status !== 'blocked') continue;
    if (String(row[dateIdx] || '').trim() !== date) continue;

    const rowStart = toMinutes_(String(row[fromIdx] || ''));
    const rowEnd = toMinutes_(String(row[toIdx] || ''));
    if (newStart < rowEnd && newEnd > rowStart) return true;
  }
  return false;
}

/**
 * Hängt eine neue Zeile an den angegebenen Tab an.
 * Spalten-Reihenfolge wird aus den Headern (Zeile 1) abgeleitet.
 */
function appendRow_(sheetName, data) {
  assertMaintenanceMarkerInactive_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);
  if (!sheet) throw new Error('Tab "' + sheetName + '" nicht gefunden.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(String);

  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const row = headers.map(h => valueOrEmpty_(data[h]));
  const lastSheetRow = sheet.getLastRow();
  const existingRows = lastSheetRow > 1
    ? sheet.getRange(2, 1, lastSheetRow - 1, headers.length).getValues()
    : [];
  let targetRow = 2;
  for (let i = existingRows.length - 1; i >= 0; i--) {
    if (existingRows[i].some(value => value !== '' && value !== null && value !== undefined && value !== false)) {
      targetRow = i + 3;
      break;
    }
  }
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
}

/**
 * Aktualisiert einzelne Spalten in einer vorhandenen Zeile.
 * rowIndex ist die absolute Zeilennummer im Sheet (1-basiert).
 */
function updateRow_(sheetName, rowIndex, data) {
  assertMaintenanceMarkerInactive_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);
  if (!sheet) throw new Error('Tab "' + sheetName + '" nicht gefunden.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(String);

  Object.keys(data).forEach((key) => {
    const col = headers.indexOf(key);
    if (col === -1) throw new Error('Tab "' + sheetName + '" enthält die Spalte "' + key + '" nicht.');
    sheet.getRange(rowIndex, col + 1).setValue(valueOrEmpty_(data[key]));
  });
}

/**
 * Sendet eine Bestätigungs-E-Mail an den Anfragenden.
 */
function sendApprovalEmail_(buildingId, requestData) {
  const settings = getSettings_();
  const notifyEmail = settings.notify_email || '';
  const building = getBuildingRecord_();
  const buildingName = building.name || buildingId;

  const subject = buildingName + ' – Buchung bestätigt: ' + requestData.date;

  const body = [
    'Hallo ' + requestData.requester_name + ',',
    '',
    'Ihre Buchungsanfrage wurde bestätigt:',
    '',
    '  Gebäude: ' + buildingName,
    '  Datum:   ' + requestData.date,
    '  Zeit:    ' + requestData.from + ' – ' + requestData.to,
    '  Zweck:   ' + requestData.title,
    '',
    'Diese Bestätigung ist automatisch generiert.',
    'Bei Rückfragen wenden Sie sich bitte an ' + notifyEmail + '.',
    '',
    'Mit freundlichen Grüßen,',
    building.operator_name || 'Ihr Vermietungsteam'
  ].join('\n');

  MailApp.sendEmail({
    to: requestData.requester_contact,
    replyTo: notifyEmail || undefined,
    subject: subject,
    name: buildingName,
    body: body
  });
}

/**
 * Sendet eine Ablehnungs-E-Mail an den Anfragenden.
 */
function sendRejectionEmail_(buildingId, requestData, reason) {
  const settings = getSettings_();
  const notifyEmail = settings.notify_email || '';
  const building = getBuildingRecord_();
  const buildingName = building.name || buildingId;

  const subject = buildingName + ' – Buchungsanfrage leider nicht möglich: '
    + requestData.date;

  const body = [
    'Hallo ' + requestData.requester_name + ',',
    '',
    'Ihre Buchungsanfrage konnte leider nicht bestätigt werden:',
    '',
    '  Gebäude: ' + buildingName,
    '  Datum:   ' + requestData.date,
    '  Zeit:    ' + requestData.from + ' – ' + requestData.to,
    '',
    reason
      ? 'Grund: ' + reason
      : 'Bitte kontaktieren Sie uns für weitere Informationen.',
    '',
    'Bei Rückfragen wenden Sie sich bitte an ' + notifyEmail + '.',
    '',
    'Mit freundlichen Grüßen,',
    building.operator_name || 'Ihr Vermietungsteam'
  ].join('\n');

  MailApp.sendEmail({
    to: requestData.requester_contact,
    replyTo: notifyEmail || undefined,
    subject: subject,
    name: buildingName,
    body: body
  });
}

/**
 * Liefert den aktiven Gebäude-Datensatz aus dem Buildings-Tab.
 */
function getBuildingRecord_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Buildings');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};
  const headers = data[0].map(String);
  const activeIdx = headers.indexOf('active');
  if (activeIdx === -1) return {};

  for (let i = 1; i < data.length; i++) {
    if (isTruthy_(data[i][activeIdx])) {
      const row = {};
      headers.forEach((h, j) => { row[h] = formatCell_(data[i][j], h); });
      return row;
    }
  }
  return {};
}

/**
 * Liest die Settings des aktiven Spreadsheets.
 */
function getSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Settings');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};
  const headers = data[0].map(String);
  const keyIdx = headers.indexOf('key');
  const valueIdx = headers.indexOf('value');
  if (keyIdx === -1 || valueIdx === -1) return {};

  const settings = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][keyIdx]).trim();
    const value = formatCell_(data[i][valueIdx], 'value');
    if (key) settings[key] = value;
  }
  return settings;
}

/**
 * Schreibt einen Eintrag in den Log-Tab.
 */
function logAction_(buildingId, action, referenceId, message) {
  appendRow_('Log', {
    timestamp: new Date().toISOString(),
    building_id: buildingId,
    action: action,
    reference_id: referenceId || '',
    message: message || ''
  });
}

// ═══════════════════════════════════════════════════════════════════
// Format-Hilfen
// ═══════════════════════════════════════════════════════════════════

function formatCell_(value, header) {
  if (value instanceof Date && ['from', 'to'].includes(header)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (typeof value === 'boolean') return value;
  return String(valueOrEmpty_(value)).trim();
}

function valueOrEmpty_(value) {
  return value === null || value === undefined ? '' : value;
}

function toMinutes_(value) {
  const parts = String(value || '00:00').split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function isTruthy_(value) {
  return ['true', 'ja', '1', 'yes'].includes(String(value).toLowerCase());
}
