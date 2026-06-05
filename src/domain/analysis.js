export function createSoilAnalysis({ coordinate, soil, municipality = null }) {
  const normalizedSoil = {
    ph: soil.ph ?? null,
    fertility: soil.fertility ?? "Sem dados",
    texture: soil.texture ?? "Sem dados",
    clay: soil.clay ?? null,
    sand: soil.sand ?? null,
    silt: calculateSilt({ sand: soil.sand, clay: soil.clay }),
    nitrogen: soil.nitrogen ?? null,
    cec: soil.cec ?? null,
    soc: soil.soc ?? null
  };

  return {
    coordinate: {
      lat: round(coordinate.lat, 6),
      lon: round(coordinate.lon, 6)
    },
    soil: normalizedSoil,
    composition: buildSoilComposition(normalizedSoil),
    municipality: municipality ? normalizeMunicipality(municipality) : null,
    source: "SoilGrids 2.0 mean 0-30cm via selected coordinate"
  };
}

export function buildSoilComposition({ sand, clay }) {
  return [
    { label: "Areia", value: safePercent(sand) },
    { label: "Argila", value: safePercent(clay) },
    { label: "Silte", value: calculateSilt({ sand, clay }) }
  ];
}

function calculateSilt({ sand, clay }) {
  if (!Number.isFinite(sand) || !Number.isFinite(clay)) {
    return null;
  }

  return safePercent(Math.max(0, 100 - sand - clay));
}

function normalizeMunicipality(municipality) {
  return {
    code_muni: municipality.code_muni ? Number(municipality.code_muni) : null,
    name_muni: municipality.name_muni ?? null,
    abbrev_state: municipality.abbrev_state ?? "PB"
  };
}

function safePercent(value) {
  return Number.isFinite(value) ? round(value, 2) : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
