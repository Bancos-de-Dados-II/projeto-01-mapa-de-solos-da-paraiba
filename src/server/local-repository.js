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
    async listMunicipalities() {
      const features = await loadFeatures();
      return features.map((feature) => ({
        code_muni: feature.properties.code_muni,
        name_muni: feature.properties.name_muni,
        abbrev_state: feature.properties.abbrev_state,
        ph: null,
        fertility: "Sem dados",
        clay: null,
        sand: null,
        nitrogen: null,
        cec: null,
        soc: null,
        texture: "Sem dados",
        centroid_lat: null,
        centroid_lon: null,
        geometry: feature.geometry
      }));
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
