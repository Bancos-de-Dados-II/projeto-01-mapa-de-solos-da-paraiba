import { buildSoilQuery, isCoordinateInParaiba, parseCoordinateInput } from "./filters.js";

const PARAIBA_CENTER = [-7.1, -36.7];
const PARAIBA_BOUNDS = [
  [-8.45, -38.9],
  [-6.0, -34.4]
];

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL ?? "http://localhost:3000";

const elements = {
  form: document.querySelector("#coordinate-form"),
  coordinate: document.querySelector("#coordinate-input"),
  clearButton: document.querySelector("#clear-button"),
  locateButton: document.querySelector("#locate-button"),
  drawButton: document.querySelector("#draw-button"),
  finishDrawButton: document.querySelector("#finish-draw-button"),
  cancelDrawButton: document.querySelector("#cancel-draw-button"),
  status: document.querySelector("#status-message"),
  area: document.querySelector("#area-value"),
  location: document.querySelector("#location-value"),
  ph: document.querySelector("#ph-value"),
  fertility: document.querySelector("#fertility-value"),
  texture: document.querySelector("#texture-value"),
  clay: document.querySelector("#clay-value"),
  nitrogen: document.querySelector("#nitrogen-value"),
  cec: document.querySelector("#cec-value"),
  soc: document.querySelector("#soc-value"),
  dominant: document.querySelector("#dominant-soil"),
  dominantMeta: document.querySelector("#dominant-meta"),
  composition: document.querySelector("#composition-list")
};

const map = L.map("map", {
  maxBounds: PARAIBA_BOUNDS,
  zoomControl: true,
  maxBoundsViscosity: 0.4
}).fitBounds(PARAIBA_BOUNDS);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 18,
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community"
  }
).addTo(map);

let municipalityLayer = null;
let selectedMarker = null;
let propertyLayer = null;
let isDrawing = false;
let draftLayer = null;
let draftMarkers = [];
let draftPoints = [];

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const coordinate = parseCoordinateInput(elements.coordinate.value);
  if (!coordinate) {
    clearSelectedMarker();
    resetPanel();
    setStatus("Informe uma coordenada valida dentro da Paraiba.");
    return;
  }

  await consultSoil({
    lat: coordinate.lat,
    lon: coordinate.lon,
    areaHectares: null
  });
});

elements.clearButton.addEventListener("click", () => {
  elements.form.reset();
  clearSelection();
  resetPanel();
  setStatus("Informe uma coordenada ou desenhe a propriedade.");
});

elements.locateButton.addEventListener("click", locateUser);
elements.drawButton.addEventListener("click", startDrawing);
elements.finishDrawButton.addEventListener("click", finishDrawing);
elements.cancelDrawButton.addEventListener("click", cancelDrawing);

map.on("click", async (event) => {
  if (isDrawing) {
    addDraftPoint(event.latlng);
    return;
  }

  await consultSoil({
    lat: event.latlng.lat,
    lon: event.latlng.lng,
    areaHectares: null
  });
});

await loadMunicipalities();
resetPanel();
setStatus("Informe uma coordenada ou desenhe a propriedade.");

async function loadMunicipalities() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/municipios`);
    if (!response.ok) {
      throw new Error(`API respondeu HTTP ${response.status}`);
    }

    const data = await response.json();
    renderMunicipalities(data);
  } catch (error) {
    setStatus(`Mapa base indisponivel: ${error.message}`);
  }
}

async function consultSoil({ lat, lon, areaHectares }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    clearSelectedMarker();
    resetPanel();
    setStatus("Coordenada invalida.");
    return;
  }

  const coordinate = { lat: round(lat, 6), lon: round(lon, 6) };
  if (!isCoordinateInParaiba(coordinate)) {
    clearSelectedMarker();
    resetPanel();
    setStatus("Coordenada fora da Paraiba.");
    return;
  }

  elements.coordinate.value = `${coordinate.lat}, ${coordinate.lon}`;
  setSelectedMarker(coordinate, { focus: areaHectares === null });
  setStatus("Consultando SoilGrids...");

  try {
    const query = buildSoilQuery(coordinate);
    const response = await fetch(`${apiBaseUrl}/api/solo?${query}`);
    if (!response.ok) {
      throw new Error(`API respondeu HTTP ${response.status}`);
    }

    const analysis = await response.json();
    renderSoilPanel(analysis, areaHectares);
    setStatus("Dados do solo carregados.");
  } catch (error) {
    resetPanel();
    setStatus(`Erro ao consultar solo: ${error.message}`);
  }
}

function renderMunicipalities(featureCollection) {
  if (municipalityLayer) {
    municipalityLayer.remove();
  }

  municipalityLayer = L.geoJSON(featureCollection, {
    style: {
      color: "#f4f1cb",
      fillOpacity: 0,
      opacity: 0.72,
      weight: 0.7
    }
  }).addTo(map);
}

function renderSoilPanel(analysis, areaHectares) {
  const { soil } = analysis;
  elements.area.textContent = areaHectares ? `${areaHectares.toFixed(2)} ha` : "-";
  elements.location.textContent = locationLabel(analysis);
  elements.ph.textContent = formatNumber(soil.ph);
  elements.fertility.textContent = soil.fertility;
  elements.texture.textContent = soil.texture;
  elements.clay.textContent = clayLevel(soil.clay);
  elements.nitrogen.textContent = `${formatNumber(soil.nitrogen)} g/kg`;
  elements.cec.textContent = `${formatNumber(soil.cec)} cmolc/kg`;
  elements.soc.textContent = `${formatNumber(soil.soc)} g/kg`;
  elements.dominant.textContent = soil.texture;
  elements.dominantMeta.textContent = `pH ${formatNumber(soil.ph)} · carbono organico ${formatNumber(soil.soc)} g/kg`;

  elements.composition.innerHTML = analysis.composition
    .map((item) => compositionRow(item))
    .join("");
}

function compositionRow(item) {
  const value = Number.isFinite(item.value) ? item.value : 0;
  return `
    <div class="composition-row">
      <div class="composition-label">
        <span class="dot ${classForComposition(item.label)}"></span>
        <span>${escapeHtml(item.label)}</span>
        <strong>${Number.isFinite(item.value) ? `${item.value.toFixed(2)}%` : "-"}</strong>
      </div>
      <div class="bar"><span style="width: ${Math.min(value, 100)}%"></span></div>
    </div>
  `;
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus("Geolocalizacao nao esta disponivel neste navegador.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await consultSoil({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        areaHectares: null
      });
      map.setView([position.coords.latitude, position.coords.longitude], 13);
    },
    () => {
      map.fitBounds(PARAIBA_BOUNDS);
      setStatus("Permissao negada. Mapa centralizado na Paraiba.");
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

function setSelectedMarker({ lat, lon }, { focus = true } = {}) {
  const latLng = [lat, lon];
  if (selectedMarker) {
    selectedMarker.setLatLng(latLng);
  } else {
    selectedMarker = L.marker(latLng).addTo(map);
  }

  selectedMarker.bindPopup("Ponto consultado").openPopup();
  if (focus) {
    map.setView(latLng, Math.max(map.getZoom(), 12));
  }
}

function clearSelection() {
  clearSelectedMarker();
  cancelDrawing();
  if (propertyLayer) {
    propertyLayer.remove();
    propertyLayer = null;
  }
  map.fitBounds(PARAIBA_BOUNDS);
}

function clearSelectedMarker() {
  if (selectedMarker) {
    selectedMarker.remove();
    selectedMarker = null;
  }
}

function resetPanel() {
  elements.area.textContent = "-";
  elements.location.textContent = "-";
  elements.ph.textContent = "-";
  elements.fertility.textContent = "-";
  elements.texture.textContent = "-";
  elements.clay.textContent = "-";
  elements.nitrogen.textContent = "-";
  elements.cec.textContent = "-";
  elements.soc.textContent = "-";
  elements.dominant.textContent = "Selecione uma coordenada";
  elements.dominantMeta.textContent = "Os dados aparecem apos a consulta.";
  elements.composition.innerHTML = "";
}

function calculateAreaHectares(latLngs) {
  return geodesicArea(latLngs) / 10000;
}

function polygonCentroid(latLngs) {
  const points = latLngs.map((point) => ({ x: point.lng, y: point.lat }));
  let area = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    area += factor;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }

  if (area === 0) {
    return propertyLayer.getBounds().getCenter();
  }

  return L.latLng(y / (3 * area), x / (3 * area));
}

function startDrawing() {
  clearPropertyLayer();
  clearDraft();
  isDrawing = true;
  setDrawingButtons(true);
  setStatus("Clique no mapa para marcar os pontos do contorno.");
}

async function finishDrawing() {
  if (draftPoints.length < 3) {
    setStatus("Marque pelo menos 3 pontos para fechar o contorno.");
    return;
  }

  const latLngs = [...draftPoints];
  clearDraft();
  isDrawing = false;
  setDrawingButtons(false);

  propertyLayer = L.polygon(latLngs, {
    color: "#e7ef64",
    dashArray: "7 5",
    fillColor: "#2d7a44",
    fillOpacity: 0.28,
    weight: 2
  }).addTo(map);
  map.fitBounds(propertyLayer.getBounds(), { padding: [24, 24] });

  const center = polygonCentroid(latLngs);
  const areaHectares = calculateAreaHectares(latLngs);
  await consultSoil({
    lat: center.lat,
    lon: center.lng,
    areaHectares
  });
}

function cancelDrawing() {
  clearDraft();
  isDrawing = false;
  setDrawingButtons(false);
}

function addDraftPoint(latlng) {
  draftPoints.push(latlng);
  draftMarkers.push(
    L.circleMarker(latlng, {
      radius: 5,
      color: "#e7ef64",
      fillColor: "#e7ef64",
      fillOpacity: 1,
      weight: 2
    }).addTo(map)
  );
  renderDraftLayer();
  setStatus(`${draftPoints.length} ponto(s) marcados no contorno.`);
}

function renderDraftLayer() {
  if (draftLayer) {
    draftLayer.remove();
  }

  if (draftPoints.length < 2) {
    return;
  }

  draftLayer = L.polyline(draftPoints, {
    color: "#e7ef64",
    dashArray: "7 5",
    weight: 2
  }).addTo(map);
}

function clearDraft() {
  if (draftLayer) {
    draftLayer.remove();
    draftLayer = null;
  }

  for (const marker of draftMarkers) {
    marker.remove();
  }
  draftMarkers = [];
  draftPoints = [];
}

function clearPropertyLayer() {
  if (propertyLayer) {
    propertyLayer.remove();
    propertyLayer = null;
  }
}

function setDrawingButtons(active) {
  elements.drawButton.classList.toggle("hidden", active);
  elements.finishDrawButton.classList.toggle("hidden", !active);
  elements.cancelDrawButton.classList.toggle("hidden", !active);
}

function geodesicArea(latLngs) {
  const earthRadius = 6378137;
  let area = 0;

  for (let index = 0; index < latLngs.length; index += 1) {
    const current = latLngs[index];
    const next = latLngs[(index + 1) % latLngs.length];
    area += toRadians(next.lng - current.lng) *
      (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)));
  }

  return Math.abs((area * earthRadius * earthRadius) / 2);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function locationLabel(analysis) {
  const municipality = analysis.municipality?.name_muni;
  const coordinate = `${formatNumber(analysis.coordinate.lat, 6)}, ${formatNumber(analysis.coordinate.lon, 6)}`;
  return municipality ? `${municipality} · ${coordinate}` : coordinate;
}

function clayLevel(value) {
  if (!Number.isFinite(value)) {
    return "Sem dados";
  }
  if (value >= 35) {
    return "Alto";
  }
  if (value >= 15) {
    return "Medio";
  }
  return "Baixo";
}

function classForComposition(label) {
  return {
    Areia: "sand",
    Argila: "clay",
    Silte: "silt"
  }[label] ?? "silt";
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "-";
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message) {
  elements.status.textContent = message;
}
