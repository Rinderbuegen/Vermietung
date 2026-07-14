import assert from "node:assert/strict";
import test from "node:test";

import { createContentRepository, resolveScopeUrl } from "../assets/js/infrastructure/content-repository.js";

const config = {
  buildingId: "dgh_rb"
};
const baseUrl = "https://example.test/Vermietung/DGH/index.html";

function json(payload, ok = true) {
  return { ok, json: async () => payload };
}

test("lädt News scope-relativ und filtert gemeinschaftliche sowie eigene Einträge", async () => {
  const calls = [];
  const repository = createContentRepository({
    config,
    baseUrl,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return json({ generatedAt: "jetzt", items: [
        { buildingId: "*", title: "Für alle" },
        { buildingId: "dgh_rb", title: "DGH" },
        { buildingId: "ev_gem_rb", title: "Fremd" },
        { title: "Ohne Scope" }
      ] });
    }
  });
  const result = await repository.getNews();
  assert.equal(calls[0].url, "https://example.test/Vermietung/DGH/assets/data/news.json");
  assert.equal(calls[0].options.cache, "no-cache");
  assert.deepEqual(result.items.map((item) => item.title), ["Für alle", "DGH"]);
});

test("lässt Download- und About-Pfade nicht aus dem Gebäudescope entkommen", async () => {
  const requested = [];
  const repository = createContentRepository({
    config,
    baseUrl,
    fetch: async (url) => {
      const value = String(url);
      requested.push(value);
      if (value.endsWith("downloads.json")) return json({ items: [
        { buildingId: "dgh_rb", title: "Hausordnung", url: "downloads/Hausordnung.pdf" },
        { buildingId: "dgh_rb", title: "Flucht", url: "../privat.pdf" }
      ] });
      if (value.endsWith("about.json")) return json({ items: [{ buildingId: "dgh_rb", url: "about.md" }] });
      return { ok: true, text: async () => "# Über uns\nGrüße aus Büdingen" };
    }
  });
  const downloads = await repository.getDownloads();
  assert.deepEqual(downloads.items.map((item) => item.url), ["https://example.test/Vermietung/DGH/downloads/Hausordnung.pdf"]);
  assert.equal(await repository.getAbout(), "# Über uns\nGrüße aus Büdingen");
  assert.equal(requested.at(-1), "https://example.test/Vermietung/DGH/about.md");
  assert.throws(() => resolveScopeUrl(baseUrl, "../../secret.txt"), /Scope/);
  assert.throws(() => resolveScopeUrl(baseUrl, "https://evil.example/a"), /Scope/);
});

test("meldet fehlende, kaputte und nicht erfolgreiche Inhaltsantworten", async () => {
  const missing = createContentRepository({ config, baseUrl, fetch: async () => json({ items: [] }) });
  await assert.rejects(() => missing.getAbout(), /Kein Über-Dokument/);
  const invalid = createContentRepository({ config, baseUrl, fetch: async () => json({ items: "falsch" }) });
  await assert.rejects(() => invalid.getNews(), /Ungültiges JSON/);
  const failed = createContentRepository({ config, baseUrl, fetch: async () => json({}, false) });
  await assert.rejects(() => failed.getNews(), /nicht geladen/);
});
