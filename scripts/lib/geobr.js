import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

export const GEOBR_RELEASE = "v2.0.0";
export const GEOBR_MUNICIPALITIES_ASSET = "municipalities_2025_simplified.parquet";
export const EXPECTED_PARAIBA_MUNICIPALITIES = 223;

export function buildGeobrDownloadUrl() {
  return `https://github.com/ipea/geobr_prep_data/releases/download/${GEOBR_RELEASE}/${GEOBR_MUNICIPALITIES_ASSET}`;
}

export async function downloadGeobrAsset({ destination, fetchImpl = globalThis.fetch }) {
  await mkdir(dirname(destination), { recursive: true });

  const response = await fetchImpl(buildGeobrDownloadUrl());
  if (!response.ok) {
    throw new Error(`Falha ao baixar geobr: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return destination;
}

export async function convertParaibaParquetToGeoJson({ input, output }) {
  const file = await asyncBufferFromFile(input);
  const rows = await parquetReadObjects({ file });
  const features = selectParaibaRows(rows).map(toMunicipalityFeature);

  await writeFile(
    output,
    JSON.stringify(
      {
        type: "FeatureCollection",
        features
      },
      null,
      2
    )
  );

  return output;
}

export function selectParaibaRows(rows) {
  return rows.filter((row) => row.abbrev_state === "PB" || Number(row.code_state) === 25);
}

export function toMunicipalityFeature(row) {
  return {
    type: "Feature",
    geometry: row.geometry,
    properties: {
      code_muni: Number(row.code_muni),
      name_muni: row.name_muni,
      abbrev_state: row.abbrev_state,
      code_state: Number(row.code_state),
      name_state: row.name_state
    }
  };
}

export function validateParaibaFeatures(features) {
  if (!Array.isArray(features)) {
    throw new Error("GeoJSON de municipios deve conter uma lista de features.");
  }

  if (features.length !== EXPECTED_PARAIBA_MUNICIPALITIES) {
    throw new Error(
      `Esperados ${EXPECTED_PARAIBA_MUNICIPALITIES} municipios da PB, encontrados ${features.length}.`
    );
  }

  const codes = new Set();
  for (const feature of features) {
    const { code_muni: codeMuni, name_muni: nameMuni } = feature.properties ?? {};
    if (!codeMuni || !nameMuni || !feature.geometry) {
      throw new Error("Cada municipio precisa de code_muni, name_muni e geometria.");
    }
    codes.add(Number(codeMuni));
  }

  if (codes.size !== EXPECTED_PARAIBA_MUNICIPALITIES) {
    throw new Error("Foram encontrados codigos IBGE duplicados no GeoJSON da PB.");
  }
}
