import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSoilComposition, createSoilAnalysis } from "../src/domain/analysis.js";

describe("soil analysis", () => {
  it("builds composition from sand, clay and derived silt", () => {
    const composition = buildSoilComposition({ sand: 58.93, clay: 22.2 });

    assert.deepEqual(composition, [
      { label: "Areia", value: 58.93 },
      { label: "Argila", value: 22.2 },
      { label: "Silte", value: 18.87 }
    ]);
  });

  it("creates a coordinate analysis without invented soil classes", () => {
    const analysis = createSoilAnalysis({
      coordinate: { lat: -7.468361, lon: -37.669256 },
      soil: {
        ph: 6.15,
        fertility: "Alta",
        texture: "Textura media",
        clay: 22.2,
        sand: 58.93,
        nitrogen: 1.19,
        cec: 19.42,
        soc: 11.92
      },
      municipality: { code_muni: 2500106, name_muni: "Agua Branca" }
    });

    assert.equal(analysis.soil.silt, 18.87);
    assert.equal(analysis.municipality.name_muni, "Agua Branca");
    assert.equal(analysis.source, "SoilGrids 2.0 mean 0-30cm via selected coordinate");
  });
});
