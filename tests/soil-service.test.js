import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSoilService } from "../src/server/soil-service.js";

describe("soil service", () => {
  it("uses cached coordinate soil data before calling SoilGrids", async () => {
    let fetched = false;
    const service = createSoilService({
      repository: {
        findSoilPoint: async () => ({
          lat: -7.468361,
          lon: -37.669256,
          ph: 6.15,
          fertility: "Alta",
          texture: "Textura media",
          clay: 22.2,
          sand: 58.93,
          nitrogen: 1.19,
          cec: 19.42,
          soc: 11.92
        }),
        findMunicipalityByCoordinate: async () => ({ name_muni: "Agua Branca" })
      },
      fetchSoil: async () => {
        fetched = true;
      }
    });

    const result = await service.analyzeCoordinate({ lat: -7.468361, lon: -37.669256 });

    assert.equal(fetched, false);
    assert.equal(result.soil.ph, 6.15);
    assert.equal(result.municipality.name_muni, "Agua Branca");
  });

  it("fetches SoilGrids and stores real coordinate soil data when cache is empty", async () => {
    const stored = [];
    const service = createSoilService({
      repository: {
        findSoilPoint: async () => null,
        saveSoilPoint: async (row) => stored.push(row),
        findMunicipalityByCoordinate: async () => null
      },
      fetchSoil: async () => ({
        ph: 6.15,
        fertility: "Alta",
        texture: "Textura media",
        clay: 22.2,
        sand: 58.93,
        nitrogen: 1.19,
        cec: 19.42,
        soc: 11.92
      })
    });

    const result = await service.analyzeCoordinate({ lat: -7.468361, lon: -37.669256 });

    assert.equal(result.soil.silt, 18.87);
    assert.equal(stored[0].ph, 6.15);
  });
});
