import { parseSoilGridsLayers } from "../../src/domain/soil.js";

export const SOILGRIDS_ENDPOINT =
  "https://rest.isric.org/soilgrids/v2.0/properties/query";
export const SOILGRIDS_PROPERTIES = ["phh2o", "clay", "sand", "nitrogen", "cec", "soc"];
export const SOILGRIDS_DEPTHS = ["0-5cm", "5-15cm", "15-30cm"];

export function buildSoilGridsUrl({ lat, lon }) {
  const url = new URL(SOILGRIDS_ENDPOINT);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  for (const property of SOILGRIDS_PROPERTIES) {
    url.searchParams.append("property", property);
  }

  for (const depth of SOILGRIDS_DEPTHS) {
    url.searchParams.append("depth", depth);
  }

  url.searchParams.set("value", "mean");
  return url.toString();
}

export async function fetchSoilGrids({ lat, lon, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(buildSoilGridsUrl({ lat, lon }));
  if (!response.ok) {
    throw new Error(`SoilGrids respondeu HTTP ${response.status}`);
  }

  return parseSoilGridsLayers(await response.json());
}

export function normalizeSoilRecord({ feature, centroid, soil }) {
  const properties = feature.properties ?? {};

  return {
    code_muni: Number(properties.code_muni),
    name_muni: properties.name_muni,
    abbrev_state: properties.abbrev_state,
    centroid_lat: centroid.lat,
    centroid_lon: centroid.lon,
    ph: soil.ph,
    clay_percent: soil.clay,
    sand_percent: soil.sand,
    nitrogen_g_kg: soil.nitrogen,
    cec_cmolc_kg: soil.cec,
    soc_g_kg: soil.soc,
    texture_class: soil.texture,
    fertility_class: soil.fertility,
    geometry: feature.geometry
  };
}
