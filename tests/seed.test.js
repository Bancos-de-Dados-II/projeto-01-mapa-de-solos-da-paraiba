import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GEOBR_MUNICIPALITIES_ASSET,
  buildGeobrDownloadUrl,
  selectParaibaRows,
  toMunicipalityFeature,
  validateParaibaFeatures
} from "../scripts/lib/geobr.js";
import { buildSoilGridsUrl, normalizeSoilRecord } from "../scripts/lib/soilgrids.js";

describe("seed helpers", () => {
  it("builds the geobr municipalities URL from the official v2 release asset", () => {
    assert.equal(GEOBR_MUNICIPALITIES_ASSET, "municipalities_2025_simplified.parquet");
    assert.equal(
      buildGeobrDownloadUrl(),
      "https://github.com/ipea/geobr_prep_data/releases/download/v2.0.0/municipalities_2025_simplified.parquet"
    );
  });

  it("filters only Paraiba rows from geobr parquet objects", () => {
    const rows = [
      { abbrev_state: "PE", code_state: 26 },
      { abbrev_state: "PB", code_state: 25 },
      { abbrev_state: "XX", code_state: "25" }
    ];

    assert.equal(selectParaibaRows(rows).length, 2);
  });

  it("converts a geobr parquet row into a GeoJSON feature", () => {
    const feature = toMunicipalityFeature({
      code_muni: "2507507",
      name_muni: "Joao Pessoa",
      abbrev_state: "PB",
      code_state: "25",
      name_state: "Paraiba",
      geometry: { type: "Polygon", coordinates: [] }
    });

    assert.deepEqual(feature, {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: {
        code_muni: 2507507,
        name_muni: "Joao Pessoa",
        abbrev_state: "PB",
        code_state: 25,
        name_state: "Paraiba"
      }
    });
  });

  it("validates that the Paraiba geobr subset has 223 municipalities", () => {
    const features = Array.from({ length: 223 }, (_, index) => ({
      properties: { code_muni: 2500000 + index, name_muni: `Municipio ${index}` },
      geometry: { type: "Polygon", coordinates: [] }
    }));

    assert.doesNotThrow(() => validateParaibaFeatures(features));
    assert.throws(() => validateParaibaFeatures(features.slice(1)), /223/);
  });

  it("builds one SoilGrids request for all required properties and topsoil depths", () => {
    const url = buildSoilGridsUrl({ lat: -7.25, lon: -36.72 });

    assert.match(url, /^https:\/\/rest\.isric\.org\/soilgrids\/v2\.0\/properties\/query\?/);
    assert.match(url, /property=phh2o/);
    assert.match(url, /property=cec/);
    assert.match(url, /depth=15-30cm/);
    assert.match(url, /value=mean/);
  });

  it("normalizes one feature and parsed soil data into a database row", () => {
    const row = normalizeSoilRecord({
      feature: {
        properties: {
          code_muni: 2507507,
          name_muni: "Joao Pessoa",
          abbrev_state: "PB"
        },
        geometry: { type: "Polygon", coordinates: [] }
      },
      centroid: { lat: -7.12, lon: -34.86 },
      soil: {
        ph: 6.43,
        clay: 19.33,
        sand: 60.67,
        nitrogen: 1.03,
        cec: 8.37,
        soc: 5.53,
        texture: "Mista",
        fertility: "Media"
      }
    });

    assert.equal(row.code_muni, 2507507);
    assert.equal(row.name_muni, "Joao Pessoa");
    assert.equal(row.centroid_lat, -7.12);
    assert.equal(row.texture_class, "Mista");
  });
});
