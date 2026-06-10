import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/server/app.js";

describe("server app", () => {
  it("responds to health checks", async () => {
    const app = createApp({ repository: fakeRepository(), soilService: fakeSoilService() });

    const response = await request(app).get("/health").expect(200);

    assert.equal(response.body.status, "ok");
  });

  it("responds to Vercel API health checks", async () => {
    const app = createApp({ repository: fakeRepository(), soilService: fakeSoilService() });

    const response = await request(app).get("/api/health").expect(200);

    assert.equal(response.body.status, "ok");
  });

  it("returns municipality outlines as a GeoJSON FeatureCollection", async () => {
    const calls = [];
    const app = createApp({
      soilService: fakeSoilService(),
      repository: fakeRepository({
        async listMunicipalities(filters) {
          calls.push(filters);
          return [featureRecord()];
        }
      })
    });

    const response = await request(app).get("/api/municipios").expect(200);

    assert.deepEqual(calls, [{ phMin: undefined, phMax: undefined, texture: undefined, municipality: undefined }]);
    assert.equal(response.body.type, "FeatureCollection");
    assert.equal(response.body.features.length, 1);
    assert.equal(response.body.features[0].properties.code_muni, 2507507);
  });

  it("passes municipality filters to the repository", async () => {
    const calls = [];
    const app = createApp({
      soilService: fakeSoilService(),
      repository: fakeRepository({
        async listMunicipalities(filters) {
          calls.push(filters);
          return [featureRecord()];
        }
      })
    });

    await request(app)
      .get("/api/municipios")
      .query({
        phMin: "6",
        phMax: "7.2",
        texture: "Textura media",
        municipality: "Campina"
      })
      .expect(200);

    assert.deepEqual(calls[0], {
      phMin: 6,
      phMax: 7.2,
      texture: "Textura media",
      municipality: "Campina"
    });
  });

  it("returns soil analysis for a coordinate", async () => {
    const calls = [];
    const app = createApp({
      repository: fakeRepository(),
      soilService: {
        async analyzeCoordinate(coordinate) {
          calls.push(coordinate);
          return soilAnalysis();
        }
      }
    });

    const response = await request(app)
      .get("/api/solo")
      .query({ lat: "-7.468361", lon: "-37.669256" })
      .expect(200);

    assert.deepEqual(calls[0], { lat: -7.468361, lon: -37.669256 });
    assert.equal(response.body.coordinate.lat, -7.468361);
    assert.equal(response.body.soil.ph, 6.15);
    assert.equal(response.body.composition[0].label, "Areia");
  });

  it("rejects invalid coordinate filters", async () => {
    const app = createApp({ repository: fakeRepository(), soilService: fakeSoilService() });

    const response = await request(app)
      .get("/api/solo")
      .query({ lat: "fora", lon: "-37.6" })
      .expect(400);

    assert.match(response.body.error, /lat/);
  });

  it("rejects coordinates outside Paraiba", async () => {
    const app = createApp({ repository: fakeRepository(), soilService: fakeSoilService() });

    const response = await request(app)
      .get("/api/solo")
      .query({ lat: "-23.55052", lon: "-46.633308" })
      .expect(400);

    assert.match(response.body.error, /Paraiba/);
  });

  it("geocodes via an injected geocoder service", async () => {
    const app = createApp({
      repository: fakeRepository(),
      soilService: fakeSoilService(),
      geocoder: {
        search: async (query) => [{ label: query, lat: -7.12, lon: -34.86 }]
      }
    });

    const response = await request(app)
      .get("/api/geocode")
      .query({ q: "Joao Pessoa" })
      .expect(200);

    assert.equal(response.body.results[0].label, "Joao Pessoa");
  });
});

function fakeRepository(overrides = {}) {
  return {
    listMunicipalities: async () => [],
    findMunicipalityByCoordinate: async () => null,
    ...overrides
  };
}

function fakeSoilService(overrides = {}) {
  return {
    analyzeCoordinate: async () => soilAnalysis(),
    ...overrides
  };
}

function soilAnalysis() {
  return {
    coordinate: { lat: -7.468361, lon: -37.669256 },
    soil: {
      ph: 6.15,
      fertility: "Alta",
      texture: "Textura media",
      clay: 22.2,
      sand: 58.93,
      silt: 18.87,
      nitrogen: 1.19,
      cec: 19.42,
      soc: 11.92
    },
    composition: [
      { label: "Areia", value: 58.93 },
      { label: "Argila", value: 22.2 },
      { label: "Silte", value: 18.87 }
    ],
    municipality: null,
    source: "SoilGrids 2.0"
  };
}

function featureRecord() {
  return {
    code_muni: 2507507,
    name_muni: "Joao Pessoa",
    abbrev_state: "PB",
    ph: 6.7,
    fertility: "Alta",
    clay: 18.4,
    sand: 62.1,
    nitrogen: 1.1,
    cec: 8.5,
    soc: 7.2,
    texture: "Arenoso",
    centroid_lat: -7.12,
    centroid_lon: -34.86,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-34.9, -7.2],
          [-34.8, -7.2],
          [-34.8, -7.1],
          [-34.9, -7.1],
          [-34.9, -7.2]
        ]
      ]
    }
  };
}
