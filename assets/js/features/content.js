import { render as renderRestrictedMarkdown } from "../shared/restricted-markdown.js";
import { todayIso } from "../domain/date-range.js";

function renderEmpty(document, target, message) {
  if (!target) return;
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message || "";
  target.replaceChildren(empty);
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSafeDownloadUrl(value) {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f\s<>\x22\x27\\]/.test(url) || url.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return /^https?:\/\/[^/]+/i.test(url);
  return !url.startsWith("#");
}

export function visibleNewsItems(items, today) {
  return (items || [])
    .filter((item) => item && item.active !== false)
    .filter((item) => !item.validFrom || item.validFrom <= today)
    .filter((item) => !item.validUntil || item.validUntil >= today)
    .sort((left, right) => Number(left.sortOrder || 999) - Number(right.sortOrder || 999)
      || String(right.date || "").localeCompare(String(left.date || "")));
}

export function createContent({
  document,
  api,
  texts = {},
  today = () => todayIso(),
  dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }),
  dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" })
}) {
  let active = true;

  function renderNews(items) {
    const list = document.getElementById("newsList");
    if (!list) return;
    if (!items.length) {
      renderEmpty(document, list, texts.newsEmpty);
      return;
    }
    list.replaceChildren(...items.map((item) => {
      const article = document.createElement("article");
      article.className = `list-item news-type-${String(item.type || "info").replace(/[^a-z0-9_-]/gi, "") || "info"}`;
      const wrapper = document.createElement("div");
      const meta = document.createElement("p");
      meta.className = "meta";
      const itemDate = validDate(item.date);
      meta.textContent = `${item.type || "info"} · ${itemDate ? dateFormatter.format(itemDate) : texts.withoutDate || ""}`;
      const title = document.createElement("h3");
      title.textContent = item.title || "";
      const body = document.createElement("div");
      body.className = "markdown";
      renderRestrictedMarkdown(body, item.body || "", { profile: "editorial", newTabHint: texts.opensNewTab });
      wrapper.append(meta, title, body);
      article.appendChild(wrapper);
      return article;
    }));
  }

  function renderDownloads(items) {
    const list = document.getElementById("downloadsList");
    if (!list) return;
    if (!items.length) {
      renderEmpty(document, list, texts.downloadsEmpty);
      return;
    }
    list.replaceChildren(...items.map((item) => {
      const article = document.createElement("article");
      article.className = "list-item";
      const wrapper = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = item.title || "";
      const description = document.createElement("p");
      description.textContent = item.description || texts.pdfDocument || "";
      wrapper.append(title, description);
      const updatedAt = validDate(item.updatedAt);
      if (updatedAt) {
        const meta = document.createElement("p");
        meta.className = "meta";
        meta.textContent = `${texts.updatedItemLabel || ""} ${dateTimeFormatter.format(updatedAt)}`.trim();
        wrapper.appendChild(meta);
      }
      article.appendChild(wrapper);
      if (isSafeDownloadUrl(item.url)) {
        const link = document.createElement("a");
        link.className = "button button-secondary";
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = texts.openPdf || "";
        article.appendChild(link);
      }
      return article;
    }));
  }

  function renderAbout(markdown) {
    const target = document.getElementById("aboutContent");
    if (target) renderRestrictedMarkdown(target, markdown || "", { profile: "editorial", newTabHint: texts.opensNewTab });
  }

  async function loadNews() {
    try {
      const data = await api.getNews();
      if (active) renderNews(visibleNewsItems(data.items, today()));
    } catch (error) {
      if (active) renderEmpty(document, document.getElementById("newsList"), `${texts.newsLoadFailed || ""} ${error.message}`.trim());
    }
  }

  async function loadDownloads() {
    try {
      const data = await api.getDownloads();
      if (active) renderDownloads(data.items || []);
    } catch (error) {
      if (active) renderEmpty(document, document.getElementById("downloadsList"), `${texts.downloadsLoadFailed || ""} ${error.message}`.trim());
    }
  }

  async function loadAbout() {
    try {
      const markdown = await api.getAbout();
      if (active) renderAbout(markdown);
    } catch (error) {
      if (active) renderEmpty(document, document.getElementById("aboutContent"), `${texts.aboutLoadFailed || ""} ${error.message}`.trim());
    }
  }

  function start() {
    active = true;
    return Promise.allSettled([loadNews(), loadDownloads(), loadAbout()]);
  }

  function dispose() {
    active = false;
  }

  return { start, loadNews, loadDownloads, loadAbout, renderNews, renderDownloads, renderAbout, dispose };
}
