const CONVERSION_FACTORS = {
  phh2o: 10,
  clay: 10,
  sand: 10,
  nitrogen: 100,
  cec: 10,
  soc: 10
};

const OUTPUT_KEYS = {
  phh2o: "ph",
  clay: "clay",
  sand: "sand",
  nitrogen: "nitrogen",
  cec: "cec",
  soc: "soc"
};

export function convertSoilGridsValue(property, value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = CONVERSION_FACTORS[property];
  if (!factor) {
    throw new Error(`Unsupported SoilGrids property: ${property}`);
  }

  return round(value / factor);
}

export function weightedTopsoilMean(depths) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const depth of depths ?? []) {
    const rawMean = depth?.values?.mean;
    if (!Number.isFinite(rawMean)) {
      continue;
    }

    const weight = depthWeight(depth.label);
    if (!weight) {
      continue;
    }

    weightedSum += rawMean * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return round(weightedSum / totalWeight);
}

export function classifyTexture({ clay, sand }) {
  if (!Number.isFinite(clay) || !Number.isFinite(sand)) {
    return "Sem dados";
  }

  if (sand >= 70 && clay < 25) {
    return "Arenoso";
  }

  if (clay >= 35) {
    return "Argiloso";
  }

  if (sand >= 55 && clay >= 25) {
    return "Mista";
  }

  return "Textura media";
}

export function classifyFertility({ ph, cec, soc, nitrogen }) {
  if (![ph, cec, soc, nitrogen].some(Number.isFinite)) {
    return "Sem dados";
  }

  const score =
    phScore(ph) +
    thresholdScore(cec, 5, 10) +
    thresholdScore(soc, 6, 12) +
    thresholdScore(nitrogen, 0.7, 1.2);

  if (score >= 6) {
    return "Alta";
  }

  if (score >= 3) {
    return "Media";
  }

  return "Baixa";
}

export function parseSoilGridsLayers(payload) {
  const result = {};
  const layers = payload?.properties?.layers ?? [];

  for (const layer of layers) {
    const key = OUTPUT_KEYS[layer.name];
    if (!key) {
      continue;
    }

    const rawTopsoilMean = weightedTopsoilMean(layer.depths);
    result[key] = convertSoilGridsValue(layer.name, rawTopsoilMean);
  }

  const texture = classifyTexture({ clay: result.clay, sand: result.sand });
  const fertility = classifyFertility({
    ph: result.ph,
    cec: result.cec,
    soc: result.soc,
    nitrogen: result.nitrogen
  });

  return {
    ph: result.ph ?? null,
    clay: result.clay ?? null,
    sand: result.sand ?? null,
    nitrogen: result.nitrogen ?? null,
    cec: result.cec ?? null,
    soc: result.soc ?? null,
    texture,
    fertility
  };
}

function depthWeight(label) {
  const match = /^(\d+)-(\d+)cm$/.exec(label ?? "");
  if (!match) {
    return 0;
  }

  return Number(match[2]) - Number(match[1]);
}

function phScore(ph) {
  if (!Number.isFinite(ph)) {
    return 0;
  }

  if (ph >= 6 && ph <= 7.3) {
    return 2;
  }

  if ((ph >= 5.5 && ph < 6) || (ph > 7.3 && ph <= 7.8)) {
    return 1;
  }

  return 0;
}

function thresholdScore(value, medium, high) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value >= high) {
    return 2;
  }

  if (value >= medium) {
    return 1;
  }

  return 0;
}

function round(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(2));
}
