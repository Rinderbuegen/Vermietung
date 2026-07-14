const DEFAULT_TEXTS = {
  bookingRequired: "Bitte alle Pflichtfelder ausfüllen und den Hinweis bestätigen.",
  invalidTime: "Bitte eine gültige Uhrzeit eintragen. Start muss vor Ende liegen.",
  contactRequired: "Bitte alle Pflichtfelder ausfüllen und den Datenschutzhinweis bestätigen."
};

export function normalizeBookingRequest(data) {
  if (data && data.allDay === "true") {
    return { ...data, from: "00:00", to: "23:59" };
  }
  return { ...data };
}

export function validateBooking(data, texts = DEFAULT_TEXTS) {
  const messages = { ...DEFAULT_TEXTS, ...texts };
  if (!data || !data.date || !data.requesterName || !data.requesterContact || !data.title || data.privacyConsent !== "on") {
    return messages.bookingRequired;
  }
  if (data.allDay === "true") return "";
  if (!data.from || !data.to || data.from >= data.to) return messages.invalidTime;
  return "";
}

export function validateContact(data, texts = DEFAULT_TEXTS) {
  const messages = { ...DEFAULT_TEXTS, ...texts };
  if (!data || !data.name || !data.contact || !data.subject || !data.message || data.privacyConsent !== "on") {
    return messages.contactRequired;
  }
  return "";
}

export function createRequestForms({
  document,
  navigator,
  api,
  FormData,
  setTimeout,
  clearTimeout,
  texts = {},
  onBookingCreated = () => {},
  logger = { warn() {} }
}) {
  const listeners = [];
  const buttonContents = new Map();
  const pendingForms = new Map();
  const focusTimers = new Set();
  let started = false;

  function listen(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    listeners.push([target, type, handler]);
  }

  function readForm(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setMessage(message, value, state = "") {
    if (!message) return;
    message.textContent = value || "";
    message.className = `form-message${state ? ` is-${state}` : ""}`;
  }

  function setFormLoading(form, loading) {
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (loading) {
      if (!buttonContents.has(button)) buttonContents.set(button, Array.from(button.childNodes));
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      button.replaceChildren(spinner, document.createTextNode(` ${texts.sending || "wird gesendet …"}`));
      button.disabled = true;
      const label = buttonContents.get(button).map((node) => node.textContent || "").join("").replace(/ senden$/, "");
      setMessage(form.querySelector(".form-message"), `${label} ${texts.sending || "wird gesendet …"}`);
      return;
    }
    const contents = buttonContents.get(button);
    button.disabled = false;
    if (contents) button.replaceChildren(...contents);
    buttonContents.delete(button);
  }

  function syncAllDay(form) {
    if (!form || !form.elements) return;
    const allDay = form.elements.allDay;
    const from = form.elements.from;
    const to = form.elements.to;
    if (!allDay || !from || !to) return;
    const disabled = allDay.value === "true";
    from.disabled = disabled;
    to.disabled = disabled;
    from.required = !disabled;
    to.required = !disabled;
    if (disabled) {
      from.value = "00:00";
      to.value = "23:59";
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pendingForms.has(form)) return;
    const message = document.getElementById("bookingMessage") || form.querySelector(".form-message");
    const rawData = readForm(form);
    const validationError = validateBooking(rawData, texts);
    if (validationError) {
      setMessage(message, validationError, "error");
      return;
    }
    if (!navigator.onLine) {
      setMessage(message, texts.bookingOffline, "error");
      return;
    }

    const data = normalizeBookingRequest(rawData);
    const submission = Symbol("booking-submission");
    pendingForms.set(form, submission);
    setFormLoading(form, true);
    try {
      const result = await api.createBookingRequest(data);
      if (pendingForms.get(form) !== submission) return;
      form.reset();
      syncAllDay(form);
      setMessage(message, texts.bookingSuccess, "success");
      try {
        const callbackResult = onBookingCreated(result, data);
        if (callbackResult && typeof callbackResult.catch === "function") callbackResult.catch((error) => logger.warn(error));
      } catch (error) {
        logger.warn(error);
      }
    } catch (error) {
      if (pendingForms.get(form) === submission) setMessage(message, error.message, "error");
    } finally {
      if (pendingForms.get(form) === submission) {
        pendingForms.delete(form);
        setFormLoading(form, false);
      }
    }
  }

  async function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pendingForms.has(form)) return;
    const message = document.getElementById("contactMessage") || form.querySelector(".form-message");
    const data = readForm(form);
    const validationError = validateContact(data, texts);
    if (validationError) {
      setMessage(message, validationError, "error");
      return;
    }
    if (!navigator.onLine) {
      setMessage(message, texts.contactOffline, "error");
      return;
    }

    const submission = Symbol("contact-submission");
    pendingForms.set(form, submission);
    setFormLoading(form, true);
    try {
      await api.createContactRequest(data);
      if (pendingForms.get(form) !== submission) return;
      form.reset();
      setMessage(message, texts.contactSuccess, "success");
    } catch (error) {
      if (pendingForms.get(form) === submission) setMessage(message, error.message, "error");
    } finally {
      if (pendingForms.get(form) === submission) {
        pendingForms.delete(form);
        setFormLoading(form, false);
      }
    }
  }

  function prefillBookingDate(date) {
    const form = document.getElementById("bookingForm");
    if (!form || !form.elements || !form.elements.date || !form.elements.allDay) return false;
    form.elements.date.value = date;
    form.elements.allDay.value = "true";
    syncAllDay(form);
    setMessage(document.getElementById("bookingMessage") || form.querySelector(".form-message"), texts.datePrefilled);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = setTimeout(() => {
      focusTimers.delete(timer);
      if (form.elements.requesterName) form.elements.requesterName.focus({ preventScroll: true });
    }, 350);
    focusTimers.add(timer);
    return true;
  }

  function start() {
    if (started) return;
    started = true;
    const bookingForm = document.getElementById("bookingForm");
    const contactForm = document.getElementById("contactForm");
    if (bookingForm) {
      const allDay = bookingForm.elements.allDay;
      listen(allDay, "change", () => syncAllDay(bookingForm));
      listen(bookingForm, "reset", () => {
        const timer = setTimeout(() => {
          focusTimers.delete(timer);
          syncAllDay(bookingForm);
        }, 0);
        focusTimers.add(timer);
      });
      listen(bookingForm, "submit", submitBooking);
      syncAllDay(bookingForm);
    }
    if (contactForm) listen(contactForm, "submit", submitContact);
  }

  function dispose() {
    listeners.splice(0).forEach(([target, type, handler]) => target.removeEventListener(type, handler));
    focusTimers.forEach((timer) => clearTimeout(timer));
    focusTimers.clear();
    buttonContents.forEach((contents, button) => {
      button.disabled = false;
      button.replaceChildren(...contents);
    });
    buttonContents.clear();
    pendingForms.clear();
    started = false;
  }

  return { start, prefillBookingDate, dispose };
}
