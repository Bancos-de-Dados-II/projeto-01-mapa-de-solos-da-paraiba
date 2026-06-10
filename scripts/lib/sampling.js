import pointOnFeature from "@turf/point-on-feature";

export function hasCoreSoilData(soil) {
  return Number.isFinite(soil?.ph) && soil?.texture && soil.texture !== "Sem dados";
}

export function buildSoilSampleCandidates({ feature, centroid }) {
  const candidates = [];
  addCandidate(candidates, centroid);
  addCandidate(candidates, pointFromFeature(feature));

  for (const point of ringSamplePoints(feature?.geometry)) {
    addCandidate(candidates, point);
  }

  return candidates;
}

function pointFromFeature(feature) {
  const [lon, lat] = pointOnFeature(feature).geometry.coordinates;
  return { lat: round(lat), lon: round(lon) };
}

function ringSamplePoints(geometry) {
  const rings = exteriorRings(geometry);
  const points = [];

  for (const ring of rings) {
    const step = Math.max(1, Math.floor(ring.length / 8));
    for (let index = 0; index < ring.length; index += step) {
      const [lon, lat] = ring[index];
      points.push({ lat: round(lat), lon: round(lon) });
    }
  }

  return points;
}

function exteriorRings(geometry) {
  if (geometry?.type === "Polygon") {
    return geometry.coordinates?.[0] ? [geometry.coordinates[0]] : [];
  }

  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates
      ?.map((polygon) => polygon?.[0])
      .filter(Boolean) ?? [];
  }

  return [];
}

function addCandidate(candidates, point) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) {
    return;
  }

  const normalized = { lat: round(point.lat), lon: round(point.lon) };
  const key = `${normalized.lat},${normalized.lon}`;
  if (!candidates.some((candidate) => `${candidate.lat},${candidate.lon}` === key)) {
    candidates.push(normalized);
  }
}

function round(value) {
  return Number(value.toFixed(6));
}
