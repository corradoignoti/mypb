const apiBaseInput = document.getElementById("apiBase");
if (window.APP_CONFIG && window.APP_CONFIG.apiBase) {
  apiBaseInput.value = window.APP_CONFIG.apiBase;
}

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

document.getElementById("geoBtn").addEventListener("click", () => locateUser({ search: false }));

function locateUser({ search }) {
  if (!navigator.geolocation) {
    setStatus(
      aroundmeStatus,
      "Il browser non supporta la geolocalizzazione. Inserisci indirizzo o coordinate manualmente per trovare i distributori vicino a te.",
      "warning"
    );
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      document.getElementById("lat").value = lat.toFixed(6);
      document.getElementById("lon").value = lon.toFixed(6);
      try {
        const address = await reverseGeocode(lat, lon);
        if (address) addressInput.value = address;
      } catch (_) {
        // reverse geocode is best-effort, ignore failures
      }
      if (search) await runAroundmeSearch();
    },
    () => {
      setStatus(
        aroundmeStatus,
        "Non abbiamo potuto accedere alla tua posizione. Condividila per vedere subito i distributori di carburante più vicini a te, oppure inserisci indirizzo o coordinate manualmente.",
        "warning"
      );
    }
  );
}

// try to locate the user and run a default search as soon as the page loads
locateUser({ search: true });

// ---- address autocomplete + geocoding (OpenStreetMap Nominatim) ----
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

const addressInput = document.getElementById("address");
const addressSuggestions = document.getElementById("addressSuggestions");
let addressDebounceTimer = null;
let addressAbortController = null;

addressInput.addEventListener("input", () => {
  const q = addressInput.value.trim();
  clearTimeout(addressDebounceTimer);
  if (q.length < 3) {
    hideAddressSuggestions();
    return;
  }
  addressDebounceTimer = setTimeout(() => searchAddress(q), 400);
});

document.addEventListener("click", (e) => {
  if (!addressInput.contains(e.target) && !addressSuggestions.contains(e.target)) {
    hideAddressSuggestions();
  }
});

async function searchAddress(q) {
  if (addressAbortController) addressAbortController.abort();
  addressAbortController = new AbortController();

  const params = new URLSearchParams({ format: "json", q, addressdetails: "1", limit: "5" });

  try {
    const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
      signal: addressAbortController.signal,
      headers: { Accept: "application/json" },
    });
    const data = await res.json();
    renderAddressSuggestions(data);
  } catch (err) {
    if (err.name !== "AbortError") hideAddressSuggestions();
  }
}

function renderAddressSuggestions(results) {
  addressSuggestions.innerHTML = "";
  if (!results || results.length === 0) {
    hideAddressSuggestions();
    return;
  }
  for (const r of results) {
    const li = document.createElement("li");
    li.textContent = r.display_name;
    li.addEventListener("click", () => {
      document.getElementById("lat").value = parseFloat(r.lat).toFixed(6);
      document.getElementById("lon").value = parseFloat(r.lon).toFixed(6);
      addressInput.value = r.display_name;
      hideAddressSuggestions();
    });
    addressSuggestions.appendChild(li);
  }
  addressSuggestions.classList.remove("hidden");
}

function hideAddressSuggestions() {
  addressSuggestions.classList.add("hidden");
  addressSuggestions.innerHTML = "";
}

async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ format: "json", lat, lon });
  const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json();
  return data.display_name || null;
}

function setStatus(el, msg, variant = false) {
  el.textContent = msg;
  el.classList.toggle("error", variant === true || variant === "error");
  el.classList.toggle("warning", variant === "warning");
}

aroundmeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await runAroundmeSearch();
});

["radius", "sort", "order", "fuel", "self"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => {
    const lat = document.getElementById("lat").value.trim();
    const lon = document.getElementById("lon").value.trim();
    if (lat && lon) runAroundmeSearch();
  });
});

async function runAroundmeSearch() {
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
}

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

  data.results.forEach((it, idx) => {
    const tr = document.createElement("tr");
    tr.className = "row-clickable";
    tr.dataset.id = it.idImpianto;
    tr.title = it.nomeImpianto || "";
    tr.innerHTML = `
      <td class="row-num">${idx + 1}</td>
      <td>${escapeHtml(it.bandiera || "")}</td>
      <td>${escapeHtml(it.comune || "")}</td>
      <td>${it.distanceKm}</td>
      <td class="${data.sort === "price" ? "" : "hidden"}">${it.prezzo ?? "-"}</td>
    `;
    aroundmeTbody.appendChild(tr);
  });

  aroundmeTbody.querySelectorAll(".row-clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      document.querySelector('[data-tab="gestore"]').click();
      document.getElementById("idImpianto").value = tr.dataset.id;
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

  data.results.forEach((it, idx) => {
    const lat = parseFloat(it.latitudine);
    const lon = parseFloat(it.longitudine);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    const priceLine = data.sort === "price" && it.prezzo != null
      ? `<div class="popup-price">€ ${escapeHtml(it.prezzo)}</div>`
      : "";

    const numberIcon = L.divIcon({
      className: "marker-pin",
      html: `
        <svg width="26" height="34" viewBox="0 0 26 34">
          <path
            d="M13 33 C13 33 25 19.5 25 13 C25 5.8 19.8 0.75 13 0.75 C6.2 0.75 1 5.8 1 13 C1 19.5 13 33 13 33 Z"
            style="fill:#2563eb; stroke:#fff; stroke-width:1.5;"
          />
          <text
            x="13" y="17.5"
            style="fill:#fff; font-weight:700; font-size:12px; font-family:sans-serif; text-anchor:middle; dominant-baseline:middle;"
          >${idx + 1}</text>
        </svg>
      `,
      iconSize: [26, 34],
      iconAnchor: [13, 33],
      popupAnchor: [0, -33],
    });

    const marker = L.marker([lat, lon], { icon: numberIcon })
      .addTo(aroundmeMapObj)
      .bindPopup(`
        <strong>#${idx + 1} &mdash; ${escapeHtml(it.nomeImpianto || "")}</strong><br>
        ${escapeHtml(it.gestore || "")}<br>
        ${escapeHtml(it.comune || "")} &mdash; ${it.distanceKm} km
        ${priceLine}
        <br><button class="popup-link-btn" data-id="${escapeHtml(it.idImpianto)}">Dettagli e prezzi</button>
      `);
    aroundmeMarkers.push(marker);
    bounds.push([lat, lon]);
  });

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

// ---- install prompt (add to home screen) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // installability is best-effort; ignore registration failures
  });
}

(function setupInstallBanner() {
  const DISMISS_KEY = "installBannerDismissed";
  const banner = document.getElementById("installBanner");
  const installBtn = document.getElementById("installBtn");
  const dismissBtn = document.getElementById("installDismissBtn");
  const bannerText = document.getElementById("installBannerText");

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone || localStorage.getItem(DISMISS_KEY)) return;

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  function showBanner() {
    banner.classList.remove("hidden");
  }

  function dismiss() {
    banner.classList.add("hidden");
    localStorage.setItem(DISMISS_KEY, "1");
  }

  dismissBtn.addEventListener("click", dismiss);

  if (isIos) {
    // Safari has no beforeinstallprompt event; show manual instructions.
    bannerText.textContent = 'Installa MyPB: tocca Condividi, poi "Aggiungi a Home".';
    installBtn.classList.add("hidden");
    showBanner();
    return;
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    dismiss();
  });

  window.addEventListener("appinstalled", dismiss);
})();

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
