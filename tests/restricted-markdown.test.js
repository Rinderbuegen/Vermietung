"use strict";

const assert = require("node:assert/strict");
const Markdown = require("../assets/js/restricted-markdown.js");

class TextNode {
  constructor(value) { this.nodeType = 3; this.value = value; }
  get textContent() { return this.value; }
}

class Element {
  constructor(name, document) {
    this.nodeType = 1;
    this.tagName = name.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.attributes = {};
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  replaceChildren(...children) { this.children = children; }
  set textContent(value) { this.children = [new TextNode(String(value))]; }
  get textContent() { return this.children.map((child) => child.textContent).join(""); }
  set className(value) { this.attributes.class = value; }
  get className() { return this.attributes.class || ""; }
  set href(value) { this.attributes.href = value; }
  get href() { return this.attributes.href; }
  set target(value) { this.attributes.target = value; }
  get target() { return this.attributes.target; }
  set rel(value) { this.attributes.rel = value; }
  get rel() { return this.attributes.rel; }
}

class Document {
  createElement(name) { return new Element(name, this); }
  createTextNode(value) { return new TextNode(value); }
}

function find(node, name, result = []) {
  if (node.tagName === name.toUpperCase()) result.push(node);
  (node.children || []).forEach((child) => find(child, name, result));
  return result;
}

assert.equal(Markdown.isAllowedLink("https://example.org/path?q=1#details"), true);
assert.equal(Markdown.isAllowedLink("HTTPS://EXAMPLE.ORG/path"), true);
assert.equal(Markdown.isAllowedLink("mailto:name@example.org"), true);
[
  "http://example.org", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:msgbox(1)",
  "/relative", "//example.org", "https:example.org", "https://user@example.org", "https://example.org/a b", "https://example.org/\npath",
  "mailto:", "mailto:name @example.org", "mailto:name%0a@example.org"
].forEach((url) => assert.equal(Markdown.isAllowedLink(url), false, url));

const parsed = Markdown.parse("**Fett** und *kursiv*\n[Seite](https://example.org/a?q=1#x)\n\nNächster Absatz: ÄÖÜß");
assert.equal(parsed.length, 2);
assert.equal(parsed[0].children.some((token) => token.type === "strong"), true);
assert.equal(parsed[0].children.some((token) => token.type === "em"), true);
assert.equal(parsed[0].children.some((token) => token.type === "br"), true);

const document = new Document();
const target = document.createElement("div");
Markdown.render(target, "[Seite](https://example.org) [Mail](mailto:name@example.org) [Nein](javascript:alert(1))\n<img src=x onerror=alert(1)> ![Bild](https://example.org/a.png)\n# Titel | Tabelle `Code`", { newTabHint: "öffnet neu" });
const links = find(target, "a");
assert.equal(links.length, 2);
assert.equal(links[0].target, "_blank");
assert.equal(links[0].rel, "noopener noreferrer");
assert.equal(links[0].children[1].className, "visually-hidden");
assert.equal(links[1].target, undefined);
assert.equal(find(target, "script").length, 0);
assert.equal(find(target, "img").length, 0);
assert.equal(find(target, "svg").length, 0);
assert.match(target.textContent, /Nein/);
assert.match(target.textContent, /<img src=x onerror=alert\(1\)>/);
assert.match(target.textContent, /!\[Bild\]\(https:\/\/example\.org\/a\.png\)/);

const malformed = Markdown.parse("[fehlend](https://example.org *offen **auch");
assert.equal(malformed[0].children.map((token) => token.value || token.type).join(""), "[fehlend](https://example.org *offen **auch");
console.log("restricted-markdown tests passed");
