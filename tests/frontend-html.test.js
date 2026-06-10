import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("frontend html", () => {
  it("does not use stale SRI attributes for CDN map assets", async () => {
    const html = await readFile("frontend/index.html", "utf8");

    assert.equal(html.includes("integrity="), false);
  });

  it("does not depend on Leaflet Draw CDN", async () => {
    const html = await readFile("frontend/index.html", "utf8");

    assert.equal(html.includes("leaflet-draw"), false);
    assert.equal(html.includes("leaflet.draw"), false);
  });

  it("contains required filter and map helper controls", async () => {
    const html = await readFile("frontend/index.html", "utf8");

    assert.match(html, /id="ph-min-input"/);
    assert.match(html, /id="ph-max-input"/);
    assert.match(html, /id="texture-filter"/);
    assert.match(html, /id="municipality-filter"/);
    assert.match(html, /id="geocode-results"/);
    assert.match(html, /id="map-legend"/);
  });
});
