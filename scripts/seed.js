import "dotenv/config";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import centroid from "@turf/centroid";
import { Pool } from "pg";

import {
  convertParaibaParquetToGeoJson,
  downloadGeobrAsset,
  GEOBR_MUNICIPALITIES_ASSET,
  validateParaibaFeatures
} from "./lib/geobr.js";
import { fetchSoilGrids, normalizeSoilRecord } from "./lib/soilgrids.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const dataDir = path.resolve(rootDir, args.dataDir ?? "data");
const parquetPath = path.join(dataDir, GEOBR_MUNICIPALITIES_ASSET);
const geoJsonPath = path.join(dataDir, "paraiba-municipalities.geojson");
const cachePath = path.join(dataDir, "soilgrids-cache.json");
const previewPath = path.join(dataDir, "paraiba-soil-preview.json");

await main();

async function main() {
  await mkdir(dataDir, { recursive: true });

  if (!existsSync(parquetPath)) {
    console.log("Baixando municipios do geobr...");
    await downloadGeobrAsset({ destination: parquetPath });
  }

  if (!existsSync(geoJsonPath)) {
    console.log("Convertendo GeoParquet do geobr para GeoJSON da PB...");
    await convertParaibaParquetToGeoJson({ input: parquetPath, output: geoJsonPath });
  }

  const geoJson = JSON.parse(await readFile(geoJsonPath, "utf8"));
  validateParaibaFeatures(geoJson.features);

  const features = args.limit ? geoJson.features.slice(0, Number(args.limit)) : geoJson.features;
  const cache = await readJsonIfExists(cachePath, {});
  const rows = [];

  for (const [index, feature] of features.entries()) {
    const codeMuni = String(feature.properties.code_muni);
    const center = centroid(feature).geometry.coordinates;
    const centroidPoint = { lon: round(center[0], 6), lat: round(center[1], 6) };

    if (!cache[codeMuni]) {
      console.log(
        `Consultando SoilGrids ${index + 1}/${features.length}: ${feature.properties.name_muni}`
      );
      cache[codeMuni] = await fetchSoilGrids(centroidPoint);
      await writeFile(cachePath, JSON.stringify(cache, null, 2));
      await delay(Number(args.delayMs ?? process.env.SOILGRIDS_DELAY_MS ?? 12500));
    }

    rows.push(
      normalizeSoilRecord({
        feature,
        centroid: centroidPoint,
        soil: cache[codeMuni]
      })
    );
  }

  await writeFile(previewPath, JSON.stringify(rows, null, 2));
  console.log(`Preview salvo em ${previewPath}`);

  if (args.dryRun || !process.env.DATABASE_URL) {
    console.log("Seed encerrado sem gravar no Supabase. Configure DATABASE_URL para inserir.");
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });

  try {
    for (const row of rows) {
      await upsertMunicipality(pool, row);
    }
  } finally {
    await pool.end();
  }

  console.log(`Seed concluido: ${rows.length} municipios gravados.`);
}

async function upsertMunicipality(pool, row) {
  await pool.query(
    `
      insert into public.soil_municipalities (
        code_muni,
        name_muni,
        abbrev_state,
        centroid_lat,
        centroid_lon,
        ph,
        clay_percent,
        sand_percent,
        nitrogen_g_kg,
        cec_cmolc_kg,
        soc_g_kg,
        texture_class,
        fertility_class,
        geom
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($14), 4326))
      )
      on conflict (code_muni) do update set
        name_muni = excluded.name_muni,
        abbrev_state = excluded.abbrev_state,
        centroid_lat = excluded.centroid_lat,
        centroid_lon = excluded.centroid_lon,
        ph = excluded.ph,
        clay_percent = excluded.clay_percent,
        sand_percent = excluded.sand_percent,
        nitrogen_g_kg = excluded.nitrogen_g_kg,
        cec_cmolc_kg = excluded.cec_cmolc_kg,
        soc_g_kg = excluded.soc_g_kg,
        texture_class = excluded.texture_class,
        fertility_class = excluded.fertility_class,
        geom = excluded.geom,
        updated_at = now()
    `,
    [
      row.code_muni,
      row.name_muni,
      row.abbrev_state,
      row.centroid_lat,
      row.centroid_lon,
      row.ph,
      row.clay_percent,
      row.sand_percent,
      row.nitrogen_g_kg,
      row.cec_cmolc_kg,
      row.soc_g_kg,
      row.texture_class,
      row.fertility_class,
      JSON.stringify(row.geometry)
    ]
  );
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    const [key, value] = arg.replace(/^--/, "").split("=");
    parsed[key] = value ?? true;
  }
  return parsed;
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

function delay(ms) {
  if (!ms) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}
