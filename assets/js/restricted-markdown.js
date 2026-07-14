(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RestrictedMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const forbiddenUrlCharacters = /[\s\u0000-\u001f\u007f]/;

  function isAllowedLink(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || forbiddenUrlCharacters.test(rawUrl)) return false;
    let url;
    try {
      url = new URL(rawUrl);
    } catch (error) {
      return false;
    }
    if (url.protocol === "https:") {
      return /^https:\/\//i.test(rawUrl) && Boolean(url.hostname) && !url.username && !url.password;
    }
    if (url.protocol !== "mailto:") return false;
    const recipient = url.pathname;
    if (!recipient || url.search || url.hash || forbiddenUrlCharacters.test(recipient)) return false;
    try {
      if (forbiddenUrlCharacters.test(decodeURIComponent(recipient))) return false;
    } catch (error) {
      return false;
    }
    return /^[^\s<>()@,;:\\"]+@[^\s<>()@,;:\\"]+\.[^\s<>()@,;:\\"]+$/.test(recipient);
  }

  function appendText(tokens, value) {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text") last.value += value;
    else tokens.push({ type: "text", value });
  }

  function completeLink(value, start) {
    if (value[start] !== "[") return null;
    const closeText = value.indexOf("](", start + 1);
    if (closeText === -1) return null;
    const closeUrl = value.indexOf(")", closeText + 2);
    if (closeUrl === -1) return null;
    return {
      text: value.slice(start + 1, closeText),
      url: value.slice(closeText + 2, closeUrl),
      end: closeUrl + 1
    };
  }

  function parseInline(value) {
    const tokens = [];
    for (let index = 0; index < value.length;) {
      if (value[index] === "!" && value[index + 1] === "[") {
        const image = completeLink(value, index + 1);
        if (image) {
          appendText(tokens, value.slice(index, image.end));
          index = image.end;
          continue;
        }
      }
      if (value[index] === "[") {
        const link = completeLink(value, index);
        if (link) {
          if (isAllowedLink(link.url)) tokens.push({ type: "link", text: link.text, url: link.url });
          else appendText(tokens, link.text);
          index = link.end;
          continue;
        }
      }
      const marker = value.startsWith("**", index) ? "**" : value[index] === "*" ? "*" : "";
      if (marker) {
        let end = value.indexOf(marker, index + marker.length);
        if (marker === "*") {
          while (end !== -1 && (value[end - 1] === "*" || value[end + 1] === "*")) end = value.indexOf(marker, end + 1);
        }
        if (end > index + marker.length) {
          tokens.push({ type: marker === "**" ? "strong" : "em", children: parseInline(value.slice(index + marker.length, end)) });
          index = end + marker.length;
          continue;
        }
      }
      appendText(tokens, value[index]);
      index += 1;
    }
    return tokens;
  }

  function parse(value) {
    const source = String(value == null ? "" : value).replace(/\r\n?/g, "\n");
    if (!source) return [];
    return source.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      children: paragraph.split("\n").flatMap((line, index) => index ? [{ type: "br" }].concat(parseInline(line)) : parseInline(line))
    }));
  }

  function renderTokens(document, target, tokens, options) {
    tokens.forEach((token) => {
      if (token.type === "text") target.appendChild(document.createTextNode(token.value));
      else if (token.type === "br") target.appendChild(document.createElement("br"));
      else if (token.type === "strong" || token.type === "em") {
        const element = document.createElement(token.type);
        renderTokens(document, element, token.children, options);
        target.appendChild(element);
      } else if (token.type === "link") {
        const link = document.createElement("a");
        link.href = token.url;
        link.textContent = token.text;
        if (/^https:/i.test(token.url)) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const hint = document.createElement("span");
          hint.className = "visually-hidden";
          hint.textContent = ` (${options.newTabHint || "öffnet in einem neuen Tab"})`;
          link.appendChild(hint);
        }
        target.appendChild(link);
      }
    });
  }

  function render(target, value, options) {
    if (!target || !target.ownerDocument) return;
    const document = target.ownerDocument;
    target.replaceChildren();
    parse(value).forEach((paragraph) => {
      const element = document.createElement("p");
      renderTokens(document, element, paragraph.children, options || {});
      target.appendChild(element);
    });
  }

  return { parse, render, isAllowedLink };
});
