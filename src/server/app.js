import cors from "cors";
import express from "express";
import helmet from "helmet";

import { createNominatimGeocoder } from "./geocoder.js";
import { createSoilService } from "./soil-service.js";

const PARAIBA_BOUNDS = {
  minLat: -8.45,
  maxLat: -6.0,
  minLon: -38.9,
  maxLon: -34.4
};

export function createApp({
  repository,
  soilService,
  geocoder = createNominatimGeocoder(),
  corsOrigin = process.env.CORS_ORIGIN ?? "*"
}) {
  if (!repository) {
    throw new Error("A repository is required to create the app.");
  }

  const app = express();
  const activeSoilService = soilService ?? createSoilService({ repository });

  app.use(helmet());
  app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  const healthHandler = (_request, response) => {
    response.json({ status: "ok" });
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.get("/api/municipios", async (request, response, next) => {
    try {
      const filters = parseMunicipalityFilters(request.query);
      const records = await repository.listMunicipalities(filters);
      response.json(toFeatureCollection(records));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/solo", async (request, response, next) => {
    try {
      const coordinate = parseCoordinateQuery(request.query);
      const analysis = await activeSoilService.analyzeCoordinate(coordinate);
      response.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/geocode", async (request, response, next) => {
    try {
      const query = String(request.query.q ?? "").trim();
      if (!query) {
        response.status(400).json({ error: "Parametro q e obrigatorio." });
        return;
      }

      const results = await geocoder.search(query);
      response.json({ results });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    const status = error.statusCode ?? 500;
    response.status(status).json({
      error: status === 500 ? "Erro interno da API." : error.message
    });
  });

  return app;
}

export function parseMunicipalityFilters(query) {
  return {
    phMin: parseOptionalNumber(query.phMin, "phMin"),
    phMax: parseOptionalNumber(query.phMax, "phMax"),
    texture: parseOptionalText(query.texture),
    municipality: parseOptionalText(query.municipality)
  };
}

export function parseCoordinateQuery(query) {
  const coordinate = {
    lat: parseRequiredCoordinate(query.lat, "lat", -90, 90),
    lon: parseRequiredCoordinate(query.lon, "lon", -180, 180)
  };

  if (!isCoordinateInParaiba(coordinate)) {
    const error = new Error("Coordenada fora da Paraiba.");
    error.statusCode = 400;
    throw error;
  }

  return coordinate;
}

export function toFeatureCollection(records) {
  return {
    type: "FeatureCollection",
    features: records.map((record) => ({
      type: "Feature",
      geometry: record.geometry,
      properties: {
        code_muni: Number(record.code_muni),
        name_muni: record.name_muni,
        abbrev_state: record.abbrev_state,
        ph: numberOrNull(record.ph),
        fertility: record.fertility,
        clay: numberOrNull(record.clay),
        sand: numberOrNull(record.sand),
        nitrogen: numberOrNull(record.nitrogen),
        cec: numberOrNull(record.cec),
        soc: numberOrNull(record.soc),
        texture: record.texture,
        centroid_lat: numberOrNull(record.centroid_lat),
        centroid_lon: numberOrNull(record.centroid_lon)
      }
    }))
  };
}

function parseOptionalNumber(value, name) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    const error = new Error(`Filtro ${name} deve ser numerico.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parseRequiredCoordinate(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    const error = new Error(`Parametro ${name} deve ser uma coordenada valida.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function isCoordinateInParaiba({ lat, lon }) {
  return (
    lat >= PARAIBA_BOUNDS.minLat &&
    lat <= PARAIBA_BOUNDS.maxLat &&
    lon >= PARAIBA_BOUNDS.minLon &&
    lon <= PARAIBA_BOUNDS.maxLon
  );
}

function parseOptionalText(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function numberOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
