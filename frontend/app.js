const apiBaseInput = document.getElementById("apiBase");

function apiBase() {
  return apiBaseInput.value.replace(/\/+$/, "");
}

// ---- tabs ----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---- aroundme ----
const aroundmeForm = document.getElementById("aroundmeForm");
const aroundmeStatus = document.getElementById("aroundmeStatus");
const aroundmeTable = document.getElementById("aroundmeTable");
const aroundmeTbody = aroundmeTable.querySelector("tbody");
const sortSelect = document.getElementById("sort");
const fuelField = document.getElementById("fuelField");
const priceCol = document.getElementById("priceCol");

sortSelect.addEventListener("change", () => {
  fuelField.classList.toggle("hidden", sortSelect.value !== "price");
});

document.getElementById("geoBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus(aroundmeStatus, "Geolocalizzazione non supportata dal browser.", true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById("lat").value = pos.coords.latitude.toFixed(6);
      document.getElementById("lon").value = pos.coords.longitude.toFixed(6);
    },
    (err) => setStatus(aroundmeStatus, `Posizione non disponibile: ${err.message}`, true)
  );
});

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

aroundmeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lat = document.getElementById("lat").value.trim();
  const lon = document.getElementById("lon").value.trim();
  const radius = document.getElementById("radius").value;
  const sort = sortSelect.value;
  const order = document.getElementById("order").value;
  const fuel = document.getElementById("fuel").value;
  const self = document.getElementById("self").value;

  const params = new URLSearchParams({ lat, lon, radius, sort, order });
  if (sort === "price") params.set("fuel", fuel);
  if (self) params.set("self", self);

  aroundmeTable.classList.add("hidden");
  setStatus(aroundmeStatus, "Ricerca in corso...");

  try {
    const res = await fetch(`${apiBase()}/aroundme?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(aroundmeStatus, data.error || "Errore.", true);
      return;
    }
    lastAroundmeData = data;
    lastAroundmeCenter = { lat: parseFloat(lat), lon: parseFloat(lon) };
    renderAroundme(data);
    resetToTableView();
    if (document.querySelector('.view-btn[data-view="map"]').classList.contains("active")) {
      showAroundmeMap(lastAroundmeData, lastAroundmeCenter.lat, lastAroundmeCenter.lon);
    }
  } catch (err) {
    setStatus(aroundmeStatus, `Impossibile contattare l'API: ${err.message}`, true);
  }
});

let lastAroundmeData = null;
let lastAroundmeCenter = null;

function resetToTableView() {
  document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('.view-btn[data-view="table"]').classList.add("active");
  document.getElementById("aroundmeMap").classList.add("hidden");
}

function renderAroundme(data) {
  aroundmeTbody.innerHTML = "";
  priceCol.classList.toggle("hidden", data.sort !== "price");

  if (data.results.length === 0) {
    setStatus(aroundmeStatus, "Nessun impianto trovato nel raggio indicato.");
    return;
  }
  setStatus(aroundmeStatus, `${data.count} impianti entro ${data.radiusKm} km.`);

  for (const it of data.results) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.nomeImpianto || "")}</td>
      <td>${escapeHtml(it.gestore || "")}</td>
      <td>${escapeHtml(it.bandiera || "")}</td>
      <td>${escapeHtml(it.comune || "")}</td>
      <td>${it.distanceKm}</td>
      <td class="${data.sort === "price" ? "" : "hidden"}">${it.prezzo ?? "-"}</td>
      <td><button class="link-btn" data-id="${it.idImpianto}">Dettagli</button></td>
    `;
    aroundmeTbody.appendChild(tr);
  }

  aroundmeTbody.querySelectorAll(".link-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector('[data-tab="gestore"]').click();
      document.getElementById("idImpianto").value = btn.dataset.id;
      gestoreForm.requestSubmit();
    });
  });

  aroundmeTable.classList.remove("hidden");
}

// ---- gestore ----
const gestoreForm = document.getElementById("gestoreForm");
const gestoreStatus = document.getElementById("gestoreStatus");
const gestoreDetail = document.getElementById("gestoreDetail");

gestoreForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("idImpianto").value.trim();
  gestoreDetail.classList.add("hidden");
  setStatus(gestoreStatus, "Ricerca in corso...");

  try {
    const res = await fetch(`${apiBase()}/gestore/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(gestoreStatus, data.error || "Errore.", true);
      return;
    }
    setStatus(gestoreStatus, "");
    renderGestore(data);
  } catch (err) {
    setStatus(gestoreStatus, `Impossibile contattare l'API: ${err.message}`, true);
  }
});

function renderGestore(data) {
  const rows = (data.prezzi || [])
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.carburante)}</td>
        <td>${escapeHtml(p.prezzo)}</td>
        <td>${p.isSelf === "1" ? "Self" : "Servito"}</td>
        <td>${escapeHtml(p.dataComunicazione)}</td>
      </tr>`
    )
    .join("");

  document.getElementById("gestoreInfo").innerHTML = `
    <h2>${escapeHtml(data.nomeImpianto || "")}</h2>
    <dl>
      <dt>idImpianto</dt><dd>${escapeHtml(data.idImpianto)}</dd>
      <dt>Gestore</dt><dd>${escapeHtml(data.gestore || "")}</dd>
      <dt>Bandiera</dt><dd>${escapeHtml(data.bandiera || "")}</dd>
      <dt>Tipo impianto</dt><dd>${escapeHtml(data.tipoImpianto || "")}</dd>
      <dt>Indirizzo</dt><dd>${escapeHtml(data.indirizzo || "")}</dd>
      <dt>Comune</dt><dd>${escapeHtml(data.comune || "")} (${escapeHtml(data.provincia || "")})</dd>
      <dt>Coordinate</dt><dd>${escapeHtml(data.latitudine)}, ${escapeHtml(data.longitudine)}</dd>
    </dl>
    <div class="wrap-x">
      <table class="results-table">
        <thead>
          <tr><th>Carburante</th><th>Prezzo</th><th>Tipo</th><th>Comunicato il</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">Nessun prezzo disponibile.</td></tr>'}</tbody>
      </table>
    </div>
  `;
  gestoreDetail.classList.remove("hidden");
  showGestoreMap(data);
}

// ---- maps (Leaflet + OpenStreetMap tiles) ----
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

let aroundmeMapObj = null;
let aroundmeMarkers = [];
let gestoreMapObj = null;

function initMap(elId) {
  const map = L.map(elId);
  L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  return map;
}

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const isMap = btn.dataset.view === "map";
    aroundmeTable.classList.toggle("hidden", isMap || !lastAroundmeData || lastAroundmeData.results.length === 0);
    document.getElementById("aroundmeMap").classList.toggle("hidden", !isMap);
    if (isMap && lastAroundmeData) {
      showAroundmeMap(lastAroundmeData, lastAroundmeCenter.lat, lastAroundmeCenter.lon);
      setTimeout(() => aroundmeMapObj && aroundmeMapObj.invalidateSize(), 0);
    }
  });
});

function showAroundmeMap(data, centerLat, centerLon) {
  if (!aroundmeMapObj) {
    aroundmeMapObj = initMap("aroundmeMap");
  }
  aroundmeMarkers.forEach((m) => aroundmeMapObj.removeLayer(m));
  aroundmeMarkers = [];

  const bounds = [];

  const centerMarker = L.circleMarker([centerLat, centerLon], {
    radius: 8,
    color: "#2563eb",
    fillColor: "#2563eb",
    fillOpacity: 0.9,
  })
    .addTo(aroundmeMapObj)
    .bindPopup("Posizione di ricerca");
  aroundmeMarkers.push(centerMarker);
  bounds.push([centerLat, centerLon]);

  for (const it of data.results) {
    const lat = parseFloat(it.latitudine);
    const lon = parseFloat(it.longitudine);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const priceLine = data.sort === "price" && it.prezzo != null
      ? `<div class="popup-price">€ ${escapeHtml(it.prezzo)}</div>`
      : "";

    const marker = L.marker([lat, lon])
      .addTo(aroundmeMapObj)
      .bindPopup(`
        <strong>${escapeHtml(it.nomeImpianto || "")}</strong><br>
        ${escapeHtml(it.gestore || "")}<br>
        ${escapeHtml(it.comune || "")} &mdash; ${it.distanceKm} km
        ${priceLine}
        <br><button class="popup-link-btn" data-id="${escapeHtml(it.idImpianto)}">Dettagli e prezzi</button>
      `);
    aroundmeMarkers.push(marker);
    bounds.push([lat, lon]);
  }

  if (bounds.length) {
    aroundmeMapObj.fitBounds(bounds, { padding: [30, 30] });
  } else {
    aroundmeMapObj.setView([centerLat, centerLon], 13);
  }
}

// popup "Dettagli e prezzi" button -> jump to gestore tab and fetch full data
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("popup-link-btn")) return;
  document.querySelector('[data-tab="gestore"]').click();
  document.getElementById("idImpianto").value = e.target.dataset.id;
  gestoreForm.requestSubmit();
});

function showGestoreMap(data) {
  const lat = parseFloat(data.latitudine);
  const lon = parseFloat(data.longitudine);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return;

  if (!gestoreMapObj) {
    gestoreMapObj = initMap("gestoreMap");
  } else {
    gestoreMapObj.eachLayer((layer) => {
      if (layer instanceof L.Marker) gestoreMapObj.removeLayer(layer);
    });
  }
  gestoreMapObj.setView([lat, lon], 15);
  L.marker([lat, lon])
    .addTo(gestoreMapObj)
    .bindPopup(escapeHtml(data.nomeImpianto || ""))
    .openPopup();
  setTimeout(() => gestoreMapObj.invalidateSize(), 0);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
