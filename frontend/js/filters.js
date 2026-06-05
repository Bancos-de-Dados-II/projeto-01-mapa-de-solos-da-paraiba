const PARAIBA_BOUNDS = {
  minLat: -8.45,
  maxLat: -6.0,
  minLon: -38.9,
  maxLon: -34.4
};

export function buildSoilQuery({ lat, lon }) {
  const params = new URLSearchParams();
  params.set("lat", String(lat).trim());
  params.set("lon", String(lon).trim());
  return params.toString();
}

export function parseCoordinateInput(value) {
  const numbers = extractNumbers(value);
  if (numbers.length < 2) {
    return null;
  }

  const direct = normalizeCoordinate({ lat: numbers[0], lon: numbers[1] });
  if (isCoordinateInParaiba(direct)) {
    return direct;
  }

  const inverted = normalizeCoordinate({ lat: numbers[1], lon: numbers[0] });
  if (isCoordinateInParaiba(inverted)) {
    return inverted;
  }

  return null;
}

export function isCoordinateInParaiba({ lat, lon }) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= PARAIBA_BOUNDS.minLat &&
    lat <= PARAIBA_BOUNDS.maxLat &&
    lon >= PARAIBA_BOUNDS.minLon &&
    lon <= PARAIBA_BOUNDS.maxLon
  );
}

function extractNumbers(value) {
  return [...String(value ?? "").matchAll(/[-+]?\d+(?:[.,]\d+)?/g)]
    .map((match) => Number(match[0].replace(",", ".")))
    .filter(Number.isFinite);
}

function normalizeCoordinate({ lat, lon }) {
  return {
    lat: round(lat, 6),
    lon: round(lon, 6)
  };
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}
