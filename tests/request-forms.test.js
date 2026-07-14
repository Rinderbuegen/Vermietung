import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestForms,
  normalizeBookingRequest,
  validateBooking,
  validateContact
} from "../assets/js/features/request-forms.js";

const validBooking = {
  date: "2026-07-20",
  allDay: "false",
  from: "10:00",
  to: "12:00",
  requesterName: "Ada",
  requesterContact: "ada@example.org",
  title: "Treffen",
  privacyConsent: "on"
};

const validContact = {
  name: "Ada",
  contact: "ada@example.org",
  subject: "Frage",
  message: "Hallo",
  privacyConsent: "on"
};

class FakeTextNode {
  constructor(value) {
    this.textContent = String(value);
  }
}

class FakeElement extends EventTarget {
  constructor(tagName, text = "") {
    super();
    this.tagName = tagName.toUpperCase();
    this.childNodes = text ? [new FakeTextNode(text)] : [];
    this.className = "";
    this.disabled = false;
    this.attributes = {};
  }

  replaceChildren(...children) {
    this.childNodes = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent || "").join("");
  }

  set textContent(value) {
    this.childNodes = [new FakeTextNode(value)];
  }
}

class FakeControl extends EventTarget {
  constructor({ name, value = "", type = "text", checked = false, required = false }) {
    super();
    this.name = name;
    this.type = type;
    this.value = value;
    this.defaultValue = value;
    this.checked = checked;
    this.defaultChecked = checked;
    this.required = required;
    this.disabled = false;
    this.focused = false;
  }

  reset() {
    this.value = this.defaultValue;
    this.checked = this.defaultChecked;
  }

  focus() {
    this.focused = true;
  }
}

class FakeForm extends EventTarget {
  constructor(elements, button, message) {
    super();
    this.elements = elements;
    this.button = button;
    this.message = message;
    this.resetCount = 0;
    this.scrollCalls = [];
  }

  querySelector(selector) {
    if (selector === 'button[type="submit"]') return this.button;
    if (selector === ".form-message") return this.message;
    return null;
  }

  reset() {
    const event = new Event("reset", { cancelable: true });
    if (!this.dispatchEvent(event)) return;
    Object.values(this.elements).forEach((control) => control.reset());
    this.resetCount += 1;
  }

  scrollIntoView(options) {
    this.scrollCalls.push(options);
  }
}

function control(name, options = {}) {
  return new FakeControl({ name, ...options });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    setTimeout(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    },
    runAll() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
    get size() {
      return callbacks.size;
    }
  };
}

function createFixture(options = {}) {
  const bookingElements = {
    buildingId: control("buildingId", { value: "dgh" }),
    date: control("date", { required: true }),
    allDay: control("allDay", { value: "false" }),
    from: control("from", { required: true }),
    to: control("to", { required: true }),
    requesterName: control("requesterName", { required: true }),
    requesterContact: control("requesterContact", { required: true }),
    title: control("title", { required: true }),
    note: control("note"),
    privacyConsent: control("privacyConsent", { type: "checkbox", value: "on", required: true })
  };
  const contactElements = {
    name: control("name", { required: true }),
    contact: control("contact", { required: true }),
    subject: control("subject", { required: true }),
    message: control("message", { required: true }),
    privacyConsent: control("privacyConsent", { type: "checkbox", value: "on", required: true })
  };
  const bookingMessage = new FakeElement("p");
  bookingMessage.className = "form-message";
  const contactMessage = new FakeElement("p");
  contactMessage.className = "form-message";
  const bookingButton = new FakeElement("button", "Anfrage senden");
  const contactButton = new FakeElement("button", "Kontakt senden");
  const bookingForm = new FakeForm(bookingElements, bookingButton, bookingMessage);
  const contactForm = new FakeForm(contactElements, contactButton, contactMessage);
  const scheduler = createScheduler();
  const navigator = { onLine: options.online !== false };
  const formDataReads = [];
  class FakeFormData {
    constructor(form) {
      formDataReads.push(form);
      this.values = Object.values(form.elements).flatMap((field) => {
        if (!field.name || field.disabled || (field.type === "checkbox" && !field.checked)) return [];
        return [[field.name, field.value]];
      });
    }

    entries() {
      return this.values[Symbol.iterator]();
    }
  }
  const nodes = { bookingForm, contactForm, bookingMessage, contactMessage };
  const document = {
    getElementById(id) {
      return nodes[id] || null;
    },
    createElement(name) {
      return new FakeElement(name);
    },
    createTextNode(value) {
      return new FakeTextNode(value);
    }
  };
  const bookingCalls = [];
  const contactCalls = [];
  const callbackCalls = [];
  const warnings = [];
  const api = {
    createBookingRequest(data) {
      bookingCalls.push(data);
      return options.createBookingRequest ? options.createBookingRequest(data) : Promise.resolve({ id: "booking-1" });
    },
    createContactRequest(data) {
      contactCalls.push(data);
      return options.createContactRequest ? options.createContactRequest(data) : Promise.resolve({ id: "contact-1" });
    }
  };
  const forms = createRequestForms({
    document,
    navigator,
    api,
    FormData: FakeFormData,
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    texts: {
      bookingRequired: "Buchung unvollständig",
      invalidTime: "Zeit ungültig",
      contactRequired: "Kontakt unvollständig",
      bookingOffline: "Buchung offline",
      contactOffline: "Kontakt offline",
      bookingSuccess: "Buchung erfolgreich",
      contactSuccess: "Kontakt erfolgreich",
      sending: "wird gesendet …",
      datePrefilled: "Datum übernommen"
    },
    onBookingCreated(result, data) {
      callbackCalls.push([result, data]);
      return options.onBookingCreated ? options.onBookingCreated(result, data) : undefined;
    },
    logger: { warn: (error) => warnings.push(error) }
  });

  return {
    forms,
    navigator,
    scheduler,
    bookingForm,
    contactForm,
    bookingElements,
    contactElements,
    bookingButton,
    contactButton,
    bookingMessage,
    contactMessage,
    bookingCalls,
    contactCalls,
    callbackCalls,
    formDataReads,
    warnings
  };
}

function fillBooking(fixture, values = validBooking) {
  Object.entries(values).forEach(([name, value]) => {
    const field = fixture.bookingElements[name];
    if (field.type === "checkbox") field.checked = value === "on";
    else field.value = value;
  });
}

function fillContact(fixture, values = validContact) {
  Object.entries(values).forEach(([name, value]) => {
    const field = fixture.contactElements[name];
    if (field.type === "checkbox") field.checked = value === "on";
    else field.value = value;
  });
}

function submit(form) {
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("Buchungsvalidierung bleibt rein und behandelt Ganztagsanfragen", () => {
  const allDay = { ...validBooking, allDay: "true", from: "", to: "" };
  const before = structuredClone(allDay);
  assert.equal(validateBooking(allDay), "");
  assert.deepEqual(allDay, before);
  assert.deepEqual(normalizeBookingRequest(allDay), { ...allDay, from: "00:00", to: "23:59" });
  assert.deepEqual(allDay, before);
});

test("Buchungs- und Kontaktvalidierung melden Pflicht- und Zeitfehler", () => {
  assert.match(validateBooking({}), /Pflichtfelder/);
  assert.match(validateBooking({ ...validBooking, from: "12:00", to: "10:00" }), /Start muss vor Ende/);
  assert.equal(validateBooking(validBooking), "");
  assert.match(validateContact({}), /Pflichtfelder/);
  assert.equal(validateContact(validContact), "");
});

test("Ganztagszustand synchronisiert nach einem Formularreset", () => {
  const fixture = createFixture();
  fixture.bookingElements.allDay.value = "true";
  fixture.forms.start();
  assert.deepEqual(
    [fixture.bookingElements.from.disabled, fixture.bookingElements.from.required, fixture.bookingElements.from.value,
      fixture.bookingElements.to.disabled, fixture.bookingElements.to.required, fixture.bookingElements.to.value],
    [true, false, "00:00", true, false, "23:59"]
  );

  fixture.bookingForm.reset();
  fixture.scheduler.runAll();
  assert.deepEqual(
    [fixture.bookingElements.from.disabled, fixture.bookingElements.from.required, fixture.bookingElements.to.disabled, fixture.bookingElements.to.required],
    [false, true, false, true]
  );
  fixture.forms.dispose();
});

test("Submit liest FormData und stoppt Validierungs- sowie Offlinefälle", () => {
  const fixture = createFixture();
  fixture.forms.start();
  fillBooking(fixture, { ...validBooking, title: "" });
  submit(fixture.bookingForm);
  assert.equal(fixture.formDataReads.length, 1);
  assert.equal(fixture.bookingCalls.length, 0);
  assert.equal(fixture.bookingMessage.textContent, "Buchung unvollständig");
  assert.equal(fixture.bookingMessage.className, "form-message is-error");

  fillBooking(fixture);
  fixture.navigator.onLine = false;
  submit(fixture.bookingForm);
  assert.equal(fixture.bookingCalls.length, 0);
  assert.equal(fixture.bookingMessage.textContent, "Buchung offline");

  fillContact(fixture, { ...validContact, message: "" });
  submit(fixture.contactForm);
  assert.equal(fixture.contactCalls.length, 0);
  assert.equal(fixture.contactMessage.textContent, "Kontakt unvollständig");

  fillContact(fixture);
  submit(fixture.contactForm);
  assert.equal(fixture.contactCalls.length, 0);
  assert.equal(fixture.contactMessage.textContent, "Kontakt offline");
  fixture.forms.dispose();
});

test("Buchungs-Submit sperrt Duplikate, normalisiert Ganztag und meldet Erfolg", async () => {
  const request = deferred();
  const callbackError = new Error("Callback fehlgeschlagen");
  const fixture = createFixture({
    createBookingRequest: () => request.promise,
    onBookingCreated: () => Promise.reject(callbackError)
  });
  fixture.forms.start();
  fillBooking(fixture, { ...validBooking, allDay: "true", from: "", to: "" });
  fixture.bookingElements.allDay.dispatchEvent(new Event("change"));
  submit(fixture.bookingForm);
  submit(fixture.bookingForm);

  assert.equal(fixture.bookingCalls.length, 1);
  assert.deepEqual(fixture.bookingCalls[0], {
    buildingId: "dgh",
    date: validBooking.date,
    allDay: "true",
    requesterName: validBooking.requesterName,
    requesterContact: validBooking.requesterContact,
    title: validBooking.title,
    note: "",
    privacyConsent: "on",
    from: "00:00",
    to: "23:59"
  });
  assert.equal(fixture.bookingButton.disabled, true);
  assert.equal(fixture.bookingButton.childNodes[0].className, "spinner");
  assert.match(fixture.bookingMessage.textContent, /wird gesendet/);

  const result = { id: "booking-7" };
  request.resolve(result);
  await flush();
  await flush();
  assert.equal(fixture.bookingForm.resetCount, 1);
  assert.equal(fixture.bookingButton.disabled, false);
  assert.equal(fixture.bookingButton.textContent, "Anfrage senden");
  assert.equal(fixture.bookingMessage.textContent, "Buchung erfolgreich");
  assert.equal(fixture.bookingMessage.className, "form-message is-success");
  assert.equal(fixture.bookingElements.allDay.value, "false");
  assert.equal(fixture.bookingElements.from.disabled, false);
  assert.equal(fixture.callbackCalls.length, 1);
  assert.deepEqual(fixture.callbackCalls[0], [result, fixture.bookingCalls[0]]);
  assert.deepEqual(fixture.warnings, [callbackError]);
  fixture.scheduler.runAll();
  fixture.forms.dispose();
});

test("Buchungsfehler erhält Formulardaten und beendet Loading", async () => {
  const request = deferred();
  const fixture = createFixture({ createBookingRequest: () => request.promise });
  fixture.forms.start();
  fillBooking(fixture);
  submit(fixture.bookingForm);
  request.reject(new Error("Buchung abgelehnt"));
  await flush();

  assert.equal(fixture.bookingForm.resetCount, 0);
  assert.equal(fixture.bookingElements.title.value, validBooking.title);
  assert.equal(fixture.bookingMessage.textContent, "Buchung abgelehnt");
  assert.equal(fixture.bookingMessage.className, "form-message is-error");
  assert.equal(fixture.bookingButton.disabled, false);
  assert.equal(fixture.callbackCalls.length, 0);
  fixture.forms.dispose();
});

test("Kontakt-Submit sperrt Duplikate, setzt Erfolg zurück und zeigt Fehler", async () => {
  const first = deferred();
  const second = deferred();
  let requestNumber = 0;
  const fixture = createFixture({
    createContactRequest: () => {
      requestNumber += 1;
      return requestNumber === 1 ? first.promise : second.promise;
    }
  });
  fixture.forms.start();
  fillContact(fixture);
  submit(fixture.contactForm);
  submit(fixture.contactForm);
  assert.equal(fixture.contactCalls.length, 1);
  assert.equal(fixture.contactButton.disabled, true);

  first.resolve({ id: "contact-1" });
  await flush();
  assert.equal(fixture.contactForm.resetCount, 1);
  assert.equal(fixture.contactMessage.textContent, "Kontakt erfolgreich");
  assert.equal(fixture.contactMessage.className, "form-message is-success");
  assert.equal(fixture.contactElements.message.value, "");
  assert.equal(fixture.contactButton.textContent, "Kontakt senden");

  fillContact(fixture);
  submit(fixture.contactForm);
  second.reject(new Error("Kontakt fehlgeschlagen"));
  await flush();
  assert.equal(fixture.contactForm.resetCount, 1);
  assert.equal(fixture.contactElements.message.value, validContact.message);
  assert.equal(fixture.contactMessage.textContent, "Kontakt fehlgeschlagen");
  assert.equal(fixture.contactMessage.className, "form-message is-error");
  assert.equal(fixture.contactButton.disabled, false);
  fixture.forms.dispose();
});

test("dispose entfernt Listener, Timer und Wirkung laufender Requests", async () => {
  const request = deferred();
  const fixture = createFixture({ createBookingRequest: () => request.promise });
  fixture.forms.start();
  fillBooking(fixture);
  submit(fixture.bookingForm);
  fixture.forms.prefillBookingDate("2026-08-01");
  assert.equal(fixture.scheduler.size, 1);
  assert.equal(fixture.bookingButton.disabled, true);

  fixture.forms.dispose();
  assert.equal(fixture.scheduler.size, 0);
  assert.equal(fixture.bookingButton.disabled, false);
  assert.equal(fixture.bookingButton.textContent, "Anfrage senden");
  request.resolve({ id: "late" });
  await flush();
  assert.equal(fixture.bookingForm.resetCount, 0);
  assert.equal(fixture.callbackCalls.length, 0);

  submit(fixture.bookingForm);
  assert.equal(fixture.bookingCalls.length, 1);
});
