import { createSoilAnalysis } from "../domain/analysis.js";
import { fetchSoilGrids } from "../../scripts/lib/soilgrids.js";

export function createSoilService({
  repository,
  fetchSoil = fetchSoilGrids
}) {
  return {
    async analyzeCoordinate(coordinate) {
      const normalized = normalizeCoordinate(coordinate);
      const cached = await repository?.findSoilPoint?.(normalized);
      const soil = cached ? soilFromCache(cached) : await fetchSoil(normalized);

      if (!cached) {
        await repository?.saveSoilPoint?.({ ...normalized, ...soil });
      }

      const municipality =
        (await repository?.findMunicipalityByCoordinate?.(normalized)) ?? null;

      return createSoilAnalysis({
        coordinate: normalized,
        soil,
        municipality
      });
    }
  };
}

export function normalizeCoordinate({ lat, lon }) {
  return {
    lat: round(Number(lat), 6),
    lon: round(Number(lon), 6)
  };
}

function soilFromCache(row) {
  return {
    ph: numberOrNull(row.ph),
    fertility: row.fertility ?? row.fertility_class ?? "Sem dados",
    texture: row.texture ?? row.texture_class ?? "Sem dados",
    clay: numberOrNull(row.clay ?? row.clay_percent),
    sand: numberOrNull(row.sand ?? row.sand_percent),
    nitrogen: numberOrNull(row.nitrogen ?? row.nitrogen_g_kg),
    cec: numberOrNull(row.cec ?? row.cec_cmolc_kg),
    soc: numberOrNull(row.soc ?? row.soc_g_kg)
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
