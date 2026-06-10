import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSoilSampleCandidates, hasCoreSoilData } from "../scripts/lib/sampling.js";

describe("soil sampling helpers", () => {
  it("detects whether SoilGrids returned usable core data", () => {
    assert.equal(hasCoreSoilData({ ph: 6.2, texture: "Textura media" }), true);
    assert.equal(hasCoreSoilData({ ph: null, texture: "Sem dados" }), false);
  });

  it("builds unique centroid and geometry candidates for a municipality", () => {
    const candidates = buildSoilSampleCandidates({
      feature: squareFeature(),
      centroid: { lat: -7.5, lon: -35.5 }
    });

    assert.deepEqual(candidates[0], { lat: -7.5, lon: -35.5 });
    assert.ok(candidates.length > 1);
    assert.equal(new Set(candidates.map((point) => `${point.lat},${point.lon}`)).size, candidates.length);
  });
});

function squareFeature() {
  return {
    type: "Feature",
    properties: { code_muni: 2500000, name_muni: "Teste" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-36, -8],
          [-35, -8],
          [-35, -7],
          [-36, -7],
          [-36, -8]
        ]
      ]
    }
  };
}
