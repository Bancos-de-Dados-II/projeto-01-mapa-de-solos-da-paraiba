import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");

export function createLocalRepository({
  geoJsonPath = path.join(rootDir, "data", "paraiba-municipalities.geojson")
} = {}) {
  let cachedFeatures = null;

  return {
    async listMunicipalities(filters = {}) {
      const features = await loadFeatures();
      return features
        .map((feature) => toRecord(feature))
        .filter((record) => matchesFilters(record, filters));
    },
    async findMunicipalityByCoordinate() {
      return null;
    },
    async findSoilPoint() {
      return null;
    },
    async saveSoilPoint() {
      return null;
    }
  };

  async function loadFeatures() {
    if (cachedFeatures) {
      return cachedFeatures;
    }

    if (!existsSync(geoJsonPath)) {
      cachedFeatures = [];
      return cachedFeatures;
    }

    const geoJson = JSON.parse(await readFile(geoJsonPath, "utf8"));
    cachedFeatures = geoJson.features ?? [];
    return cachedFeatures;
  }
}

function toRecord(feature) {
  return {
    code_muni: feature.properties.code_muni,
    name_muni: feature.properties.name_muni,
    abbrev_state: feature.properties.abbrev_state,
    ph: feature.properties.ph ?? null,
    fertility: feature.properties.fertility ?? "Sem dados",
    clay: feature.properties.clay ?? null,
    sand: feature.properties.sand ?? null,
    nitrogen: feature.properties.nitrogen ?? null,
    cec: feature.properties.cec ?? null,
    soc: feature.properties.soc ?? null,
    texture: feature.properties.texture ?? "Sem dados",
    centroid_lat: feature.properties.centroid_lat ?? null,
    centroid_lon: feature.properties.centroid_lon ?? null,
    geometry: feature.geometry
  };
}

function matchesFilters(record, filters) {
  if (Number.isFinite(filters.phMin) && !(Number(record.ph) >= filters.phMin)) {
    return false;
  }
  if (Number.isFinite(filters.phMax) && !(Number(record.ph) <= filters.phMax)) {
    return false;
  }
  if (filters.texture && record.texture !== filters.texture) {
    return false;
  }
  if (filters.municipality) {
    const value = String(filters.municipality).trim().toLowerCase();
    const codeMatches = String(record.code_muni) === value;
    const nameMatches = String(record.name_muni ?? "").toLowerCase().includes(value);
    return codeMatches || nameMatches;
  }
  return true;
}
