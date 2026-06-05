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
});
