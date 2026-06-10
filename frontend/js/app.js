import {
  buildMunicipalityQuery,
  buildSoilQuery,
  isCoordinateInParaiba,
  normalizeSearchText,
  parseCoordinateInput
} from "./filters.js";

const PARAIBA_BOUNDS = [
  [-8.45, -38.9],
  [-6.0, -34.4]
];

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL ?? "";

const elements = {
  form: document.querySelector("#coordinate-form"),
  coordinate: document.querySelector("#coordinate-input"),
  geocodeResults: document.querySelector("#geocode-results"),
  filterForm: document.querySelector("#filter-form"),
  phMin: document.querySelector("#ph-min-input"),
  phMax: document.querySelector("#ph-max-input"),
  textureFilter: document.querySelector("#texture-filter"),
  municipalityFilter: document.querySelector("#municipality-filter"),
  clearFiltersButton: document.querySelector("#clear-filters-button"),
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
let labelLayer = L.layerGroup().addTo(map);
let municipalityLayersByCode = new Map();
let allMunicipalityFeatures = [];
let selectedMarker = null;
let propertyLayer = null;
let isDrawing = false;
let draftLayer = null;
let draftMarkers = [];
let draftPoints = [];

elements.form.addEventListener("submit", handleSearchSubmit);
elements.filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await applyFilters({ focusSelected: true });
});
elements.municipalityFilter.addEventListener("change", async () => {
  await applyFilters({ focusSelected: true });
});
elements.clearFiltersButton.addEventListener("click", async () => {
  clearFilterInputs();
  await loadMunicipalities();
  map.fitBounds(PARAIBA_BOUNDS);
  setStatus("Filtros limpos. Todos os municipios da Paraiba exibidos.");
});
elements.clearButton.addEventListener("click", () => {
  elements.form.reset();
  clearGeocodeResults();
  clearSelection();
  resetPanel();
  setStatus("Informe uma coordenada, municipio, endereco ou desenhe a propriedade.");
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
setStatus("Informe uma coordenada, municipio, endereco ou desenhe a propriedade.");

async function handleSearchSubmit(event) {
  event.preventDefault();
  const text = elements.coordinate.value.trim();
  if (!text) {
    setStatus("Informe uma coordenada, municipio ou endereco.");
    return;
  }

  const coordinate = parseCoordinateInput(text);
  if (coordinate) {
    clearGeocodeResults();
    await consultSoil({
      lat: coordinate.lat,
      lon: coordinate.lon,
      areaHectares: null
    });
    return;
  }

  const municipality = findMunicipalityFeature(text);
  if (municipality) {
    clearGeocodeResults();
    clearFilterInputs();
    elements.municipalityFilter.value = String(municipality.properties.code_muni);
    await loadMunicipalities(getFilterValues());
    focusMunicipality(municipality.properties.code_muni, { openPopup: true });
    renderMunicipalityPanel(municipality);
    return;
  }

  await geocodeAndConsult(text);
}

async function loadMunicipalities(filters = {}) {
  try {
    const query = buildMunicipalityQuery(filters);
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${apiBaseUrl}/api/municipios${suffix}`);
    if (!response.ok) {
      throw new Error(`API respondeu HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!hasActiveFilters(filters)) {
      allMunicipalityFeatures = data.features;
      populateMunicipalityFilter(allMunicipalityFeatures);
    }
    renderMunicipalities(data);

    if (data.features.length === 0) {
      setStatus("Nenhum municipio encontrado para os filtros aplicados.");
      return;
    }

    if (filters.municipality) {
      focusMunicipality(filters.municipality, { openPopup: true });
      return;
    }

    setStatus(`${data.features.length} municipio(s) exibido(s) no mapa.`);
  } catch (error) {
    setStatus(`Mapa base indisponivel: ${error.message}`);
  }
}

async function applyFilters({ focusSelected = false } = {}) {
  const filters = getFilterValues();
  await loadMunicipalities(filters);

  if (focusSelected && filters.municipality) {
    focusMunicipality(filters.municipality, { openPopup: true });
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
  labelLayer.clearLayers();
  municipalityLayersByCode = new Map();

  municipalityLayer = L.geoJSON(featureCollection, {
    style: (feature) => municipalityStyle(feature.properties),
    onEachFeature: (feature, layer) => {
      const code = String(feature.properties.code_muni);
      municipalityLayersByCode.set(code, { feature, layer });
      layer.bindPopup(municipalityPopup(feature));
      layer.on("click", (event) => {
        if (event.originalEvent) {
          L.DomEvent.stopPropagation(event.originalEvent);
        }
        renderMunicipalityPanel(feature);
        layer.openPopup();
        setStatus(`Municipio selecionado: ${feature.properties.name_muni}.`);
      });
    }
  }).addTo(map);

  renderMunicipalityLabels(featureCollection.features);
}

function renderMunicipalityLabels(features) {
  for (const feature of features) {
    const { centroid_lat: lat, centroid_lon: lon, name_muni: name } = feature.properties;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    L.marker([lat, lon], {
      icon: L.divIcon({
        className: "municipality-label",
        html: escapeHtml(name)
      }),
      interactive: false,
      keyboard: false
    }).addTo(labelLayer);
  }
}

function renderMunicipalityPanel(feature) {
  renderSoilPanel(analysisFromMunicipality(feature), null);
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

async function geocodeAndConsult(query) {
  setStatus("Buscando endereco...");
  try {
    const response = await fetch(`${apiBaseUrl}/api/geocode?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`API respondeu HTTP ${response.status}`);
    }

    const { results } = await response.json();
    renderGeocodeResults(results);
    if (!results.length) {
      setStatus("Nenhum endereco encontrado na Paraiba.");
      return;
    }

    await selectGeocodeResult(results[0]);
  } catch (error) {
    clearGeocodeResults();
    setStatus(`Erro na geocodificacao: ${error.message}`);
  }
}

async function selectGeocodeResult(result) {
  clearGeocodeResults();
  elements.coordinate.value = `${round(result.lat, 6)}, ${round(result.lon, 6)}`;
  await consultSoil({
    lat: Number(result.lat),
    lon: Number(result.lon),
    areaHectares: null
  });
}

function renderGeocodeResults(results = []) {
  elements.geocodeResults.innerHTML = results
    .map((result, index) => `
      <button type="button" data-index="${index}">
        ${escapeHtml(result.label)}
      </button>
    `)
    .join("");
  elements.geocodeResults.classList.toggle("hidden", !results.length);

  [...elements.geocodeResults.querySelectorAll("button")].forEach((button) => {
    button.addEventListener("click", async () => {
      await selectGeocodeResult(results[Number(button.dataset.index)]);
    });
  });
}

function clearGeocodeResults() {
  elements.geocodeResults.innerHTML = "";
  elements.geocodeResults.classList.add("hidden");
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

function focusMunicipality(code, { openPopup = false } = {}) {
  const entry = municipalityLayersByCode.get(String(code));
  if (!entry) {
    return;
  }

  map.fitBounds(entry.layer.getBounds(), { padding: [24, 24] });
  renderMunicipalityPanel(entry.feature);
  if (openPopup) {
    entry.layer.openPopup();
  }
}

function populateMunicipalityFilter(features) {
  const current = elements.municipalityFilter.value;
  const options = [...features]
    .sort((a, b) => a.properties.name_muni.localeCompare(b.properties.name_muni, "pt-BR"))
    .map((feature) => `
      <option value="${feature.properties.code_muni}">
        ${escapeHtml(feature.properties.name_muni)}
      </option>
    `)
    .join("");

  elements.municipalityFilter.innerHTML = `<option value="">Todos</option>${options}`;
  elements.municipalityFilter.value = current;
}

function findMunicipalityFeature(query) {
  const normalizedQuery = normalizeSearchText(query);
  return allMunicipalityFeatures.find((feature) => {
    const code = String(feature.properties.code_muni);
    const name = normalizeSearchText(feature.properties.name_muni);
    return code === normalizedQuery || name === normalizedQuery || name.includes(normalizedQuery);
  });
}

function getFilterValues() {
  return {
    phMin: elements.phMin.value,
    phMax: elements.phMax.value,
    texture: elements.textureFilter.value,
    municipality: elements.municipalityFilter.value
  };
}

function clearFilterInputs() {
  elements.phMin.value = "";
  elements.phMax.value = "";
  elements.textureFilter.value = "";
  elements.municipalityFilter.value = "";
}

function hasActiveFilters(filters) {
  return Boolean(filters.phMin || filters.phMax || filters.texture || filters.municipality);
}

function municipalityStyle(properties) {
  return {
    color: "#fff8c7",
    fillColor: phColor(properties.ph),
    fillOpacity: 0.62,
    opacity: 0.9,
    weight: 0.8
  };
}

function phColor(value) {
  const ph = Number(value);
  if (!Number.isFinite(ph)) {
    return "#9aa19a";
  }
  if (ph < 5.5) {
    return "#c84b31";
  }
  if (ph < 6.2) {
    return "#e2a340";
  }
  if (ph <= 7.3) {
    return "#4f9d5d";
  }
  return "#6c8fbd";
}

function municipalityPopup(feature) {
  const soil = soilFromMunicipality(feature.properties);
  return `
    <strong>${escapeHtml(feature.properties.name_muni)}</strong>
    <p>pH ${formatNumber(soil.ph)} · ${escapeHtml(soil.texture)}</p>
    <p>Fertilidade: ${escapeHtml(soil.fertility)}</p>
    <p>Argila ${formatNumber(soil.clay)}% · Areia ${formatNumber(soil.sand)}%</p>
    <p>N ${formatNumber(soil.nitrogen)} g/kg · CEC ${formatNumber(soil.cec)} cmolc/kg</p>
  `;
}

function analysisFromMunicipality(feature) {
  const soil = soilFromMunicipality(feature.properties);
  return {
    coordinate: {
      lat: numberOrNull(feature.properties.centroid_lat),
      lon: numberOrNull(feature.properties.centroid_lon)
    },
    soil,
    composition: compositionFromSoil(soil),
    municipality: {
      code_muni: feature.properties.code_muni,
      name_muni: feature.properties.name_muni,
      abbrev_state: feature.properties.abbrev_state
    },
    source: "SoilGrids 2.0 mean 0-30cm via municipio"
  };
}

function soilFromMunicipality(properties) {
  const clay = numberOrNull(properties.clay);
  const sand = numberOrNull(properties.sand);
  return {
    ph: numberOrNull(properties.ph),
    fertility: properties.fertility ?? "Sem dados",
    texture: properties.texture ?? "Sem dados",
    clay,
    sand,
    silt: deriveSilt({ clay, sand }),
    nitrogen: numberOrNull(properties.nitrogen),
    cec: numberOrNull(properties.cec),
    soc: numberOrNull(properties.soc)
  };
}

function compositionFromSoil(soil) {
  return [
    { label: "Areia", value: soil.sand },
    { label: "Argila", value: soil.clay },
    { label: "Silte", value: soil.silt }
  ];
}

function deriveSilt({ clay, sand }) {
  if (!Number.isFinite(clay) || !Number.isFinite(sand)) {
    return null;
  }
  return Math.max(0, round(100 - clay - sand, 2));
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "-";
}

function numberOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits) {
  return Number(Number(value).toFixed(digits));
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
