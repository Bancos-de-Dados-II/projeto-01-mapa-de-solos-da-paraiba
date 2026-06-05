import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSoilQuery, parseCoordinateInput } from "../frontend/js/filters.js";

describe("frontend coordinate helpers", () => {
  it("serializes coordinates for soil analysis", () => {
    const query = buildSoilQuery({ lat: "-7.468361", lon: "-37.669256" });

    assert.equal(query, "lat=-7.468361&lon=-37.669256");
  });

  it("parses a pasted latitude and longitude pair", () => {
    assert.deepEqual(parseCoordinateInput("-7.468361, -37.669256"), {
      lat: -7.468361,
      lon: -37.669256
    });
  });

  it("parses a pasted longitude and latitude pair for Paraiba", () => {
    assert.deepEqual(parseCoordinateInput("-37.669256, -7.468361"), {
      lat: -7.468361,
      lon: -37.669256
    });
  });

  it("returns null when coordinate input is incomplete", () => {
    assert.equal(parseCoordinateInput("-7.468361"), null);
  });

  it("returns null when coordinates are outside Paraiba", () => {
    assert.equal(parseCoordinateInput("-23.55052, -46.633308"), null);
  });
});
