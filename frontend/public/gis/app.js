/**
 * GridSense Pro — Real-Time GIS SCADA Telemetry & GNN Resiliency Engine
 * Implements clean point map with asset categories, real-time live telemetry stream,
 * asset inspector, causal root-cause separation, and what-if mitigation.
 */

const API_BASE = (typeof window !== 'undefined' && window.location.port === "3000") ? "http://localhost:8000" : "";

const GridApp = (() => {
  // Application State
  const state = {
    currentGridState: null,
    currentModelOutput: null,
    currentPitchStep: 1,
    showCascadePath: true,
    scenarios: {},
    selectedNodeId: "T17",
    isSimulating: false,
    isLiveStreaming: true,
    streamTimer: null,
    map: null,
    markersLayer: null,
    cityLayer: null,
    cityContextLayer: null,
    conditionPathLayer: null,
    realtimeLayer: null,
    linesLayer: null,
    cascadeVectorLayer: null,
    markerInstances: {},
    sparklineChart: null,
    baseLoad: 4.25,
    citiesById: {},
    conditions: [],
    realtimeTransformers: [],
    pendingRealtimeAssetId: null,
    activeDatasetContext: null,
    activeDatasetConditionId: null,
    theme: "dark"
  };

  // Real Geospatial Coordinates for Maharashtra State Power Grid Assets
  const GEO_COORDINATES = {
    // ── MAHARASHTRA STATE POWER GRID CORE STRATEGIC ASSETS ──
    "T17": { lat: 19.9975, lng: 73.7898, name: "Nashik Heavy Step-Down T17", city: "Nashik, Maharashtra", category: "Transformer" },
    "F8": { lat: 19.2500, lng: 73.8300, name: "Feeder F8 Nashik-Pune Corridor", city: "Ahmednagar/Pune, Maharashtra", category: "Feeder" },
    "S4": { lat: 18.5204, lng: 73.8567, name: "Pune 400kV Grid Substation S4", city: "Pune, Maharashtra", category: "Substation" },
    "S3": { lat: 19.0760, lng: 72.8777, name: "Mumbai Central Grid Substation S3", city: "Mumbai, Maharashtra", category: "Substation" },
    "S1": { lat: 19.2000, lng: 72.9900, name: "Thane-Kalwa 400kV Grid Substation S1", city: "Thane, Maharashtra", category: "Substation" },
    "S2": { lat: 19.8762, lng: 75.3433, name: "Chhatrapati Sambhajinagar Sub S2", city: "Chhatrapati Sambhajinagar, Maharashtra", category: "Substation" },
    "S5": { lat: 17.6599, lng: 75.9064, name: "Solapur 400kV Grid Substation S5", city: "Solapur, Maharashtra", category: "Substation" },
    "S6": { lat: 16.7050, lng: 74.2433, name: "Kolhapur 400kV Regional Substation S6", city: "Kolhapur, Maharashtra", category: "Substation" },
    "S7": { lat: 20.7453, lng: 78.6022, name: "Wardha 765kV Super Grid Substation S7", city: "Wardha, Maharashtra", category: "Substation" },
    "S8": { lat: 20.9374, lng: 77.7796, name: "Amravati 400kV Grid Substation S8", city: "Amravati, Maharashtra", category: "Substation" },
    "S9": { lat: 19.1383, lng: 77.3210, name: "Nanded EHV Grid Substation S9", city: "Nanded, Maharashtra", category: "Substation" },
    "S10": { lat: 19.9800, lng: 73.8100, name: "Nashik EHV Super Substation S10", city: "Nashik, Maharashtra", category: "Substation" },
    "G1": { lat: 17.4000, lng: 73.7500, name: "Koyna Hydroelectric Complex G1", city: "Satara, Maharashtra", category: "Generator" },
    "G2": { lat: 19.9500, lng: 79.3000, name: "Chandrapur Super Thermal Plant G2", city: "Chandrapur, Maharashtra", category: "Generator" },
    "G3": { lat: 19.8300, lng: 72.6600, name: "Tarapur Atomic Power Station G3", city: "Palghar, Maharashtra", category: "Generator" },
    "G4": { lat: 21.2500, lng: 79.1000, name: "Koradi Super Thermal Plant G4", city: "Nagpur, Maharashtra", category: "Generator" },
    "G5": { lat: 19.0100, lng: 72.9000, name: "Trombay Thermal Power Station G5", city: "Mumbai, Maharashtra", category: "Generator" },
    "G6": { lat: 21.2800, lng: 79.1200, name: "Khaperkheda Thermal Plant G6", city: "Nagpur, Maharashtra", category: "Generator" },
    "G7": { lat: 21.0500, lng: 75.8000, name: "Bhusawal Deepnagar Thermal Plant G7", city: "Jalgaon, Maharashtra", category: "Generator" },
    "G8": { lat: 18.8500, lng: 76.5000, name: "Parli Super Thermal Power Station G8", city: "Beed, Maharashtra", category: "Generator" },
    "T3": { lat: 19.2403, lng: 73.1305, name: "Kalyan Industrial Transformer T3", city: "Kalyan, Maharashtra", category: "Transformer" },
    "T14": { lat: 21.1458, lng: 79.0882, name: "Nagpur Interconnect Transformer T14", city: "Nagpur, Maharashtra", category: "Transformer" },
    "T19": { lat: 19.8800, lng: 75.3800, name: "Chikalthana Industrial Transformer T19", city: "Aurangabad, Maharashtra", category: "Transformer" },
    "T1": { lat: 19.0330, lng: 73.0297, name: "Navi Mumbai EHV Step-Down T1", city: "Navi Mumbai, Maharashtra", category: "Transformer" },
    "T5": { lat: 19.0952, lng: 74.7496, name: "Ahmednagar Regional Transformer T5", city: "Ahmednagar, Maharashtra", category: "Transformer" },
    "T6": { lat: 16.9902, lng: 73.3120, name: "Ratnagiri Coastal Grid Transformer T6", city: "Ratnagiri, Maharashtra", category: "Transformer" },
    "T7": { lat: 16.8524, lng: 74.5815, name: "Sangli Industrial Step-Down T7", city: "Sangli, Maharashtra", category: "Transformer" },
    "T8": { lat: 20.7002, lng: 77.0082, name: "Akola Central Transformer T8", city: "Akola, Maharashtra", category: "Transformer" },
    "T9": { lat: 18.4088, lng: 76.5604, name: "Latur Industrial Transformer T9", city: "Latur, Maharashtra", category: "Transformer" },
    "L1": { lat: 18.5910, lng: 73.7389, name: "Pune Hinjewadi IT Load Center L1", city: "Pune, Maharashtra", category: "Load Center" },
    "L2": { lat: 19.0800, lng: 72.8800, name: "Mumbai Financial Capital Load L2", city: "Mumbai, Maharashtra", category: "Load Center" },
    "L3": { lat: 21.0500, lng: 79.0500, name: "Nagpur MIHAN Industrial Load L3", city: "Nagpur, Maharashtra", category: "Load Center" },

    // ── Maharashtra Sub-Regional Network & Interconnects ──
    "F2": { lat: 21.0077, lng: 75.5626, name: "Jalgaon Central Feeder F2", city: "Jalgaon, Maharashtra", category: "Feeder" },
    "F6": { lat: 17.6805, lng: 74.0183, name: "Satara Grid Feeder F6", city: "Satara, Maharashtra", category: "Feeder" },
    "F10": { lat: 21.4624, lng: 80.1961, name: "Gondia Interconnect Feeder F10", city: "Gondia, Maharashtra", category: "Feeder" },
    "T11": { lat: 19.8410, lng: 75.8864, name: "Jalna Steel City Step-Down T11", city: "Jalna, Maharashtra", category: "Transformer" },
    "F12": { lat: 20.9042, lng: 74.7749, name: "Dhule EHV Feeder F12", city: "Dhule, Maharashtra", category: "Feeder" },
    "T13": { lat: 20.3888, lng: 78.1204, name: "Yavatmal Regional Transformer T13", city: "Yavatmal, Maharashtra", category: "Transformer" },
    "F15": { lat: 16.1200, lng: 73.5600, name: "Sindhudurg Coastal Feeder F15", city: "Sindhudurg, Maharashtra", category: "Feeder" },
    "F16": { lat: 16.7800, lng: 74.4100, name: "Kolhapur-Sangli Trunk Line F16", city: "Kolhapur, Maharashtra", category: "Feeder" },
    "T18": { lat: 21.1700, lng: 79.6500, name: "Bhandara Grid Transformer T18", city: "Bhandara, Maharashtra", category: "Transformer" },
    "F20": { lat: 18.9891, lng: 75.7601, name: "Beed Transmission Feeder F20", city: "Beed, Maharashtra", category: "Feeder" },
    "F22": { lat: 20.1800, lng: 80.0000, name: "Gadchiroli Transmission Feeder F22", city: "Gadchiroli, Maharashtra", category: "Feeder" },
    "T23": { lat: 20.5300, lng: 76.1800, name: "Buldhana Regional Step-Down T23", city: "Buldhana, Maharashtra", category: "Transformer" },
    "T24": { lat: 21.3700, lng: 74.2400, name: "Nandurbar Transmission Transformer T24", city: "Nandurbar, Maharashtra", category: "Transformer" },
    "F25": { lat: 18.1860, lng: 76.0419, name: "Dharashiv Transmission Feeder F25", city: "Dharashiv, Maharashtra", category: "Feeder" },
    "F26": { lat: 20.3500, lng: 78.9500, name: "Chandrapur-Wardha Heavy Trunk F26", city: "Chandrapur, Maharashtra", category: "Feeder" },
    "T27": { lat: 20.1100, lng: 77.1300, name: "Washim Agricultural Step-Down T27", city: "Washim, Maharashtra", category: "Transformer" },
    "F28": { lat: 19.7200, lng: 77.1500, name: "Hingoli Grid Feeder F28", city: "Hingoli, Maharashtra", category: "Feeder" },
    "T29": { lat: 21.2200, lng: 79.1500, name: "Nagpur North Tie Transformer T29", city: "Nagpur, Maharashtra", category: "Transformer" },
    "T30": { lat: 19.9800, lng: 79.2800, name: "Chandrapur Industrial Step-Down T30", city: "Chandrapur, Maharashtra", category: "Transformer" },
    "F31": { lat: 18.1500, lng: 74.5800, name: "Baramati Agro Feeder F31", city: "Pune, Maharashtra", category: "Feeder" },
    "T32": { lat: 20.9500, lng: 77.7500, name: "Amravati MIDC Step-Down T32", city: "Amravati, Maharashtra", category: "Transformer" },
    "T33": { lat: 20.7200, lng: 78.5800, name: "Wardha MIDC Transformer T33", city: "Wardha, Maharashtra", category: "Transformer" }
  };

  /**
   * Initializes the application and Leaflet GIS map.
   */
  async function init() {
    if (window.lucide) lucide.createIcons();
    applyTheme(window.localStorage.getItem("gridsense-theme") || "dark");
    window.addEventListener("storage", (event) => {
      if (event.key === "gridsense-theme") applyTheme(event.newValue || "dark");
    });
    // The embedded explorer shares its parent's visual system. Storage events
    // do not fire in every same-window iframe configuration, so accept the
    // explicit, same-origin message emitted by the application shell as well.
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "gridsense-theme") applyTheme(event.data.theme);
      if (event.data?.type === "gridsense-focus-asset" && event.data.assetId) window.setTimeout(() => focusRealtimeTransformer(event.data.assetId), 250);
      if (event.data?.type === "gridsense-focus-city" && event.data.city) window.setTimeout(() => focusCityContext(event.data.city, event.data.state), 150);
    });

    initLeafletMap();
    startClock();
    startLiveTelemetryStream();
    loadRealtimeTransformerFeed();
    window.setInterval(loadRealtimeTransformerFeed, 2000);
    setupEventListeners();
    loadDatasetMenus();
    const customGrid = readCustomGrid();
    if (customGrid) {
      renderState(customGrid, buildCustomPrediction(customGrid));
      fitAllBounds();
      return;
    }

    await fetchInitialTopology();
    window.setInterval(fetchInitialTopology, 2000);
  }

  /**
   * Initializes the Leaflet Map with CartoDB Dark Matter / OpenStreetMap tiles.
   */
  function initLeafletMap() {
    const mapEl = document.getElementById("leaflet-map");
    if (!mapEl) return;

    state.map = L.map("leaflet-map", {
      zoomControl: false,
      attributionControl: true
    }).setView([19.25, 75.80], 7);

    L.control.zoom({ position: "bottomright" }).addTo(state.map);

    // OpenStreetMap standard tiles do not require an API key for normal browser use.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
    }).addTo(state.map);

    // Feature Groups for layer management
    state.linesLayer = L.featureGroup().addTo(state.map);
    state.cascadeVectorLayer = L.featureGroup().addTo(state.map);
    state.markersLayer = L.featureGroup().addTo(state.map);
    state.cityLayer = L.featureGroup().addTo(state.map);
    state.cityContextLayer = L.featureGroup().addTo(state.map);
    state.conditionPathLayer = L.featureGroup().addTo(state.map);
    state.realtimeLayer = L.featureGroup().addTo(state.map);

    // Invalidate map size so it renders fully inside flex/grid containers & iframes
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 150);
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 600);
    window.addEventListener("resize", () => { if (state.map) state.map.invalidateSize(); });
  }

  function setupEventListeners() {
    const stressSlider = document.getElementById("slider-stress");
    const searchInput = document.getElementById("mapSearch");

    if (stressSlider) {
      stressSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById("label-stress-val").innerText = `${val.toFixed(2)}x (+${Math.round((val-1)*100)}%)`;
      });
    }

    if (searchInput) {
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchNode();
      });
    }
  }

  async function loadDatasetMenus() {
    await Promise.all([loadCityMenu(), loadConditionMenu()]);
  }

  async function loadCityMenu() {
    const selector = document.getElementById("citySelector");
    if (!selector) return;

    try {
      const response = await fetch(`${API_BASE}/api/cities?limit=20000`);
      if (!response.ok) throw new Error(`City dataset request failed (${response.status})`);
      const cities = await response.json();
      state.citiesById = Object.fromEntries(cities.map((city) => [city.city_id, city]));

      const options = document.createDocumentFragment();
      const prompt = new Option(`Select a city (20,000 available)`, "");
      prompt.selected = true;
      options.appendChild(prompt);
      cities.forEach((city) => {
        options.appendChild(new Option(`${city.city}, ${city.state}`, city.city_id));
      });
      selector.replaceChildren(options);
    } catch (error) {
      console.warn("City dataset unavailable; retaining the map's local city search.", error);
      selector.replaceChildren(new Option("City dataset unavailable — start the API", ""));
    }
  }

  async function loadConditionMenu() {
    const selector = document.getElementById("mapScenarioFilter");
    if (!selector) return;

    try {
      const response = await fetch(`${API_BASE}/api/scenarios?limit=5000`);
      if (!response.ok) throw new Error(`Condition dataset request failed (${response.status})`);
      state.conditions = await response.json();
      populateConditionMenu(state.conditions);
    } catch (error) {
      console.warn("Condition dataset unavailable; retaining the local baseline.", error);
      selector.replaceChildren(new Option("Condition dataset unavailable — start the API", ""));
    }
  }

  function populateConditionMenu(conditions) {
    const selector = document.getElementById("mapScenarioFilter");
    if (!selector) return;
    const options = document.createDocumentFragment();
    const prompt = new Option(`Select a GNN condition (${conditions.length.toLocaleString()} shown)`, "");
    prompt.selected = true;
    options.appendChild(prompt);
    conditions.forEach((condition) => {
      options.appendChild(new Option(condition.title, condition.id));
    });
    selector.replaceChildren(options);
  }

  function filterConditionMenu(query) {
    const normalized = String(query || "").trim().toLowerCase();
    const filtered = normalized
      ? state.conditions.filter((condition) => `${condition.id} ${condition.title} ${condition.description}`.toLowerCase().includes(normalized))
      : state.conditions;
    populateConditionMenu(filtered);
  }

  async function loadRealtimeTransformerFeed() {
    const list = document.getElementById("alerts-container");
    const source = document.getElementById("alert-count-badge");
    if (!list) return;
    try {
      const response = await fetch(`${API_BASE}/api/realtime/transformers?limit=12`);
      if (!response.ok) throw new Error(`Transformer feed request failed (${response.status})`);
      const feed = await response.json();
      renderRealtimeTransformers(feed);
      if (source) source.innerText = `${feed.transformers.filter((item) => item.status !== "STABLE").length} LIVE ALERTS`;
    } catch (error) {
      if (source) source.innerText = "FEED UNAVAILABLE";
      console.warn("Realtime transformer feed unavailable.", error);
    }
  }

  function renderRealtimeTransformers(feed) {
    const list = document.getElementById("alerts-container");
    if (!list) return;
    const transformers = feed.transformers || [];
    state.realtimeTransformers = transformers;
    if (state.pendingRealtimeAssetId) {
      const pending = state.pendingRealtimeAssetId;
      state.pendingRealtimeAssetId = null;
      focusRealtimeTransformer(pending);
    }
    const alerts = transformers.filter((item) => item.status !== "STABLE");
    list.innerHTML = (alerts.length ? alerts : transformers.slice(0, 3)).map((item) => {
      const statusClass = item.status === "BLACKOUT RISK" ? "border-rose-600 bg-rose-950/50 text-rose-200" : item.status === "CRITICAL" ? "border-amber-600 bg-amber-950/40 text-amber-200" : item.status === "WARNING" ? "border-yellow-700 bg-yellow-950/30 text-yellow-200" : "border-emerald-800 bg-emerald-950/20 text-emerald-200";
      return `<button class="w-full text-left rounded border p-2 transition hover:border-cyan-400 ${statusClass}" onclick="GridApp.focusRealtimeTransformer('${item.asset_id}')"><span class="font-bold">${item.asset_id}</span> <span class="float-right">${item.status}</span><br/><span>Load ${item.load_pct}% · ${item.voltage_pu} pu · ${item.temperature_c}°C · Risk ${item.risk_pct}%</span></button>`;
    }).join("");

    if (!state.realtimeLayer) return;
    state.realtimeLayer.clearLayers();
    transformers.forEach((item) => {
      if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lon))) return;
      const color = item.status === "BLACKOUT RISK" ? "#f43f5e" : item.status === "CRITICAL" ? "#f59e0b" : "#22c55e";
      L.circleMarker([Number(item.lat), Number(item.lon)], { radius: item.status === "BLACKOUT RISK" ? 9 : 6, color, fillColor: color, fillOpacity: 0.85, weight: 2 })
        .bindTooltip(`<b>${item.asset_id}</b><br/>${item.status}<br/>Load: ${item.load_pct}% · Voltage: ${item.voltage_pu} pu · Risk: ${item.risk_pct}%`)
        .addTo(state.realtimeLayer);
    });
  }

  function focusRealtimeTransformer(assetId) {
    const asset = state.realtimeTransformers.find((item) => item.asset_id === assetId);
    if (!asset) {
      state.pendingRealtimeAssetId = assetId;
      return;
    }
    const marker = state.realtimeLayer?.getLayers().find((layer) => layer.getTooltip?.()?.getContent?.().includes(assetId));
    if (marker && state.map) {
      state.map.setView(marker.getLatLng(), 9, { animate: true });
      marker.openTooltip();
    }
    if (asset) updateRealtimeInspector(asset);
  }

  // Operations links may target any city. Keep the inspector tied to that
  // asset rather than falling back to the original Nashik demonstration node.
  function updateRealtimeInspector(asset) {
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
    const city = `${asset.city || "Regional"}, ${asset.state || "India"}`;
    state.selectedNodeId = asset.asset_id;
    state.activeDatasetContext = null;
    state.activeDatasetConditionId = null;
    setText("ins-asset-name", `${asset.asset_id} — nearest grid station`);
    setText("ins-location", `${city} • TRANSFORMER`);
    setText("ins-load", `${asset.load_pct}%`);
    setText("ins-volt", `${asset.voltage_pu} pu`);
    setText("ins-temp", `${asset.temperature_c} °C`);
    setText("ins-ttc", asset.risk_pct >= 70 ? "Repair now" : asset.risk_pct >= 40 ? "Monitor closely" : "Stable");
    const badge = document.getElementById("ins-status-badge");
    if (badge) badge.innerText = asset.status || "LIVE CONTEXT";
    const desc = document.getElementById("intervene-action-desc");
    if (desc) desc.innerText = `Route response through ${asset.asset_id}, the nearest monitored station for ${city}.`;
    setMitigationStatus(asset.risk_pct >= 70 ? "critical" : asset.risk_pct >= 40 ? "warning" : "stable", asset.asset_id);
  }

  function selectSearchedCondition(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = String(event.target.value || "").trim().toLowerCase();
    const matching = state.conditions.filter((condition) =>
      `${condition.id} ${condition.title} ${condition.description}`.toLowerCase().includes(query)
    );
    const exact = matching.find((condition) => condition.id.toLowerCase() === query);
    const selected = exact || matching[0];
    if (!selected) return;
    const selector = document.getElementById("mapScenarioFilter");
    if (selector) selector.value = selected.id;
    switchScenario(selected.id);
  }

  function startClock() {
    setInterval(() => {
      const now = new Date();
      const istStr = `IST ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)}`;
      const clockEl = document.getElementById("live-clock");
      if (clockEl) clockEl.innerText = istStr;
    }, 1000);
  }

  /**
   * Real-Time SCADA Telemetry Streamer.
   * Periodically updates frequency, demand, and micro-variations.
   */
  function startLiveTelemetryStream() {
    if (state.streamTimer) clearInterval(state.streamTimer);

    state.streamTimer = setInterval(() => {
      if (!state.isLiveStreaming) return;

      // Realistic SCADA frequency micro-jitter around 59.98 Hz
      const freq = 59.98 + Math.sin(Date.now() / 9000) * 0.02;
      const freqEl = document.getElementById("header-freq");
      const footerFreqEl = document.getElementById("footer-freq");
      if (freqEl) freqEl.innerText = `${freq.toFixed(2)} Hz`;
      if (footerFreqEl) footerFreqEl.innerText = `${freq.toFixed(2)} Hz`;

      // Smooth deterministic display-only aggregate, aligned with the backend
      // telemetry cadence. Asset values themselves always come from /api/live/grid.
      const deltaDemand = Math.sin(Date.now() / 12000) * 0.02;
      const currentDemand = (state.baseLoad + deltaDemand).toFixed(2);
      const demandPct = ((deltaDemand / state.baseLoad) * 100 + 1.2).toFixed(1);
      const footerDemandEl = document.getElementById("footer-demand");
      if (footerDemandEl) {
        footerDemandEl.innerHTML = `${currentDemand} GW <span class="text-[10px] text-emerald-400 font-normal font-sans">+${demandPct}%</span>`;
      }

      // A randomized city keeps a live, station-specific readout after it is
      // selected. This updates the Current Grid Status card every 1.5 seconds.
      if (state.activeDatasetContext) {
        const { asset, city, isCritical } = state.activeDatasetContext;
        updateDatasetInspector(asset, city, isCritical, true);
      }

    }, 1500);
  }

  function toggleLiveStream() {
    state.isLiveStreaming = !state.isLiveStreaming;
    const badge = document.getElementById("live-stream-badge");
    const btnText = document.getElementById("btn-stream-text");

    if (state.isLiveStreaming) {
      if (badge) {
        badge.innerText = "LIVE REAL-TIME STREAM";
        badge.className = "text-emerald-400 font-bold";
      }
      if (btnText) btnText.innerText = "Pause Stream";
    } else {
      if (badge) {
        badge.innerText = "STREAM PAUSED";
        badge.className = "text-amber-400 font-bold";
      }
      if (btnText) btnText.innerText = "Resume Stream";
    }
  }

  function getNodeTypeName(id) {
    if (id === "S1" || id === "S4") return "Substation";
    if (id.startsWith("T")) return "Transformer";
    return "Feeder Node";
  }

  function readCustomGrid() {
    try {
      const raw = window.sessionStorage.getItem("gridsense-custom-grid");
      const grid = raw ? JSON.parse(raw) : null;
      return grid && Array.isArray(grid.nodes) && Array.isArray(grid.edges) ? grid : null;
    } catch (error) {
      console.warn("Unable to load custom GIS dataset", error);
      return null;
    }
  }

  function buildCustomPrediction(gridState) {
    const nodeRisk = {};
    (gridState.nodes || []).forEach((node) => {
      const features = node.features || {};
      const load = Number(features.load_pct || 0);
      const voltage = Number(features.voltage_pu || 1);
      const temperature = Number(features.temperature_c || 35);
      nodeRisk[node.id] = Math.max(0.01, Math.min(0.99, ((load - 60) / 55) * 0.62 + (0.98 - voltage) * 6 + Math.max(0, temperature - 65) / 70));
    });
    const ranked = Object.entries(nodeRisk).sort(([, a], [, b]) => b - a);
    const top = ranked[0];
    return { node_risk: nodeRisk, root_cause_ranking: top ? [{ node: top[0], node_id: top[0], root_cause_score: top[1], explained_by_upstream: false }] : [], cascade_path: [], cascade_risk_pct: Math.round((ranked.slice(0, 3).reduce((total, [, risk]) => total + risk, 0) / Math.max(1, Math.min(3, ranked.length))) * 1000) / 10, confidence_interval: {}, time_to_critical_hours: {} };
  }

  function getNodeGeo(node) {
    const known = GEO_COORDINATES[node.id];
    if (known) return known;
    const lat = Number(node.lat);
    const lng = Number(node.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, name: node.label || node.id, city: node.state || node.region || "Custom dataset", category: node.type || "Asset" };
  }

  async function fetchInitialTopology() {
    // A selected condition is its own GNN assessment. Do not replace its
    // cascade path/risk with the background national live-baseline refresh.
    if (state.activeDatasetConditionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/live/grid`);
      if (!res.ok) throw new Error(`Live grid request failed (${res.status})`);
      const payload = await res.json();
      renderState(payload.grid_state, payload.model_output);
    } catch (err) {
      console.warn("Backend unavailable; showing the built-in India grid baseline.", err);
      renderState(buildOfflineBaseline(), buildOfflinePrediction());
      fitAllBounds();
    }
  }

  // The GIS remains usable when the optional Python service is not running.
  function buildOfflineBaseline() {
    return {
      timestamp: new Date().toISOString(),
      nodes: Object.entries(GEO_COORDINATES).map(([id, geo]) => ({
        id,
        type: geo.category.toLowerCase().replace(" ", "_"),
        status: "ONLINE",
        features: { load_pct: id === "T17" ? 84.2 : 55, voltage_pu: id === "T17" ? 0.972 : 1.0, temperature_c: id === "T17" ? 71 : 52 }
      })),
      edges: [],
      overall_health_pct: 98.4
    };
  }

  function buildOfflinePrediction() {
    const nodeRisk = Object.fromEntries(Object.keys(GEO_COORDINATES).map((id) => [id, id === "T17" ? 0.86 : 0.05]));
    return {
      node_risk: nodeRisk,
      root_cause_ranking: [{ node: "T17", explained_by_upstream: false }],
      cascade_path: ["T17", "F8", "S4"],
      cascade_risk_pct: 86,
      confidence_interval: {},
      time_to_critical_hours: { T17: 6.2 }
    };
  }

  /**
   * Renders the complete dashboard from gridState and modelOutput.
   */
  function renderState(gridState, modelOutput) {
    state.currentGridState = gridState;
    state.currentModelOutput = modelOutput;

    renderLeafletLayers(gridState, modelOutput);
    updateMetricsAndPanels(gridState, modelOutput);
    updateQuickFocus(gridState);
    updateLiveAlerts(gridState, modelOutput);
    updateInspectorPanel(state.selectedNodeId);
    updateSignalChain(state.selectedNodeId);
  }

  function updateQuickFocus(gridState) {
    const container = document.getElementById("asset-quick-focus");
    if (!container) return;
    const categories = [["transformer", "TRANSFORMERS"], ["feeder", "FEEDERS"], ["substation", "SUBSTATIONS"]];
    const countBadge = document.getElementById("quick-focus-count");
    if (countBadge) countBadge.innerText = `${(gridState.nodes || []).length} NODES`;
    container.innerHTML = categories.map(([type, label]) => {
      const assets = (gridState.nodes || []).filter((node) => node.type === type);
      const critical = assets.filter((node) => node.status === "critical" || node.status === "root_cause").length;
      const warning = assets.filter((node) => node.status === "warning" || node.status === "high_risk").length;
      return `<button onclick="GridApp.selectCategory('${type}')" class="w-full rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-cyan-500/50"><span class="font-bold text-slate-200">${label}</span><span class="float-right text-cyan-300">${assets.length} nodes</span><br/><span class="mt-1 block text-[10px] font-mono text-slate-400">Healthy: ${assets.length - warning - critical} · Warning: ${warning} · Critical: ${critical}</span></button>`;
    }).join("");
  }

  // Alerts are derived from the same authoritative live snapshot as the map.
  function updateLiveAlerts(gridState, modelOutput) {
    const list = document.getElementById("alerts-container");
    const badge = document.getElementById("alert-count-badge");
    if (!list || !badge) return;
    const risks = modelOutput.node_risk || {};
    const active = (gridState.nodes || []).filter((node) => node.status === "root_cause" || node.status === "critical" || node.status === "warning" || Number(risks[node.id]) >= 0.30).sort((a, b) => Number(risks[b.id] || 0) - Number(risks[a.id] || 0)).slice(0, 7);
    badge.innerText = `${active.length} LIVE ALERT${active.length === 1 ? "" : "S"}`;
    list.innerHTML = active.length ? active.map((node) => {
      const f = node.features || {}, risk = Number(risks[node.id] || node.risk_score || 0);
      const critical = node.status === "root_cause" || node.status === "critical" || risk >= 0.70;
      return `<button class="w-full text-left rounded border p-2 transition hover:border-cyan-400 ${critical ? "border-rose-600 bg-rose-950/50 text-rose-200" : "border-red-700 bg-red-950/30 text-red-100"}" onclick="GridApp.focusNode('${node.id}')"><span class="font-bold">${node.id}</span><span class="float-right">${node.status === "root_cause" ? "ROOT CAUSE" : critical ? "CRITICAL" : "WARNING"}</span><br/><span>Load ${f.load_pct}% · ${f.voltage_pu} pu · ${f.temperature_c}°C · Risk ${(risk * 100).toFixed(1)}%</span></button>`;
    }).join("") : `<div class="rounded border border-emerald-800 bg-emerald-950/20 p-2 text-emerald-200">No active operating alerts.</div>`;
  }

  /**
   * Renders Leaflet Markers and Transmission Lines.
   */
  function renderLeafletLayers(gridState, modelOutput) {
    if (!state.map) return;

    state.markersLayer.clearLayers();
    state.linesLayer.clearLayers();
    state.cascadeVectorLayer.clearLayers();
    state.markerInstances = {};

    const nodeRisk = modelOutput.node_risk || {};
    const rootCauses = modelOutput.root_cause_ranking || [];
    const cascadePath = modelOutput.cascade_path || [];

    // Find top root cause
    const topRootCause = rootCauses.find(rc => !rc.explained_by_upstream) || rootCauses[0];
    const trueRootNodeId = topRootCause ? (topRootCause.node || topRootCause.node_id) : null;

    // 1. Draw Transmission Lines (Polylines)
    (gridState.edges || []).forEach(edge => {
      const uGeo = getNodeGeo((gridState.nodes || []).find(node => node.id === edge.source) || { id: edge.source });
      const vGeo = getNodeGeo((gridState.nodes || []).find(node => node.id === edge.target) || { id: edge.target });
      if (!uGeo || !vGeo) return;

      const uRisk = nodeRisk[edge.source] || 0;
      const vRisk = nodeRisk[edge.target] || 0;
      const avgRisk = (uRisk + vRisk) / 2;

      let lineColor = "#10b981"; // Healthy Emerald
      let lineWeight = 2.5;
      let opacity = 0.85;

      if (edge.status === "TRIPPED" || uRisk > 0.80 || vRisk > 0.80) {
        lineColor = "#ef4444"; // Crimson
        lineWeight = 3.5;
      } else if (avgRisk > 0.35 || edge.loading_pct > 70) {
        lineColor = "#f59e0b"; // Amber
        lineWeight = 3.0;
      }

      const isSelectedSignal = state.selectedNodeId === edge.source || state.selectedNodeId === edge.target;
      const polyline = L.polyline([
        [uGeo.lat, uGeo.lng],
        [vGeo.lat, vGeo.lng]
      ], {
        color: isSelectedSignal ? "#22d3ee" : lineColor,
        weight: isSelectedSignal ? Math.max(lineWeight, 4) : lineWeight,
        opacity: edge.status === "TRIPPED" ? 0.3 : opacity,
        dashArray: isSelectedSignal ? "8, 6" : (edge.status === "TRIPPED" ? "5, 5" : null),
        className: isSelectedSignal ? "signal-chain-line" : ""
      });

      polyline.bindTooltip(`
        <div class="font-mono text-[10px]">
          <b class="text-cyan-300">${edge.source} ➔ ${edge.target}</b><br/>
          <span>Flow: ${edge.flow_mw || 0} MVA (${edge.loading_pct || 0}%)</span><br/>
          <span>Status: ${edge.status}</span>
        </div>
      `, { sticky: true });

      state.linesLayer.addLayer(polyline);
    });

    // 2. Draw Cascade Propagation Path Highlight
    if (state.showCascadePath && cascadePath.length > 1) {
      const latlngs = [];
      cascadePath.forEach(nid => {
        const geo = getNodeGeo((gridState.nodes || []).find(node => node.id === nid) || { id: nid });
        if (geo) latlngs.push([geo.lat, geo.lng]);
      });

      if (latlngs.length > 1) {
        const cascadeLine = L.polyline(latlngs, {
          color: "#f43f5e",
          weight: 5,
          opacity: 0.9,
          dashArray: "8, 6"
        });
        state.cascadeVectorLayer.addLayer(cascadeLine);
      }
    }

    // 3. Draw Plain Markers for All 33 Assets with Category Styling
    const typeFilter = document.getElementById("mapTypeFilter") ? document.getElementById("mapTypeFilter").value : "";
    const statusFilter = document.getElementById("mapStatusFilter") ? document.getElementById("mapStatusFilter").value : "";

    (gridState.nodes || []).forEach(node => {
      const geo = getNodeGeo(node);
      if (!geo) return;

      const risk = nodeRisk[node.id] || 0.05;
      const isRootCause = node.status === "root_cause" || (node.id === trueRootNodeId && risk > 0.20);
      const isSymptom = rootCauses.some(rc => (rc.node || rc.node_id) === node.id && rc.explained_by_upstream);

      // Filtering check
      if (typeFilter && node.type !== typeFilter) return;
      if (statusFilter === "healthy" && risk >= 0.30) return;
      if (statusFilter === "stressed" && (risk < 0.30 || risk > 0.70)) return;
      if (statusFilter === "critical" && risk < 0.70) return;

      let markerClass = "marker-healthy";
      if (node.status === "TRIPPED" || node.status === "critical") {
        markerClass = "marker-critical";
      } else if (isRootCause) {
        markerClass = "marker-root-cause";
      } else if (risk >= 0.70) {
        markerClass = "marker-critical";
      } else if (node.status === "warning" || node.status === "high_risk" || risk >= 0.30) {
        markerClass = "marker-alert";
      }

      const isSub = (node.type === "substation");
      const isCrit = (risk >= 0.70 || isRootCause || node.status === "TRIPPED" || node.status === "critical");
      const isAlert = (!isCrit && (node.status === "warning" || node.status === "high_risk" || risk >= 0.30));

      // Clean, professional SCADA Marker with Permanent City & Asset Label
      const iconHtml = `
        <div class="flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="node-marker-body ${markerClass} ${isSub ? 'marker-substation' : ''}" style="${isCrit ? 'box-shadow: 0 0 20px #ef4444, 0 0 40px #ef4444;' : ''}">
            <span style="font-size: 8px; font-weight: 800; color: #141414; font-family: monospace;">${node.id}</span>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap shadow-md border ${
            isRootCause ? 'bg-amber-950/95 text-amber-300 border-amber-500' :
            isCrit ? 'bg-rose-950/95 text-rose-300 border-rose-600' :
            isAlert ? 'bg-slate-900/90 text-amber-300 border-amber-600/50' :
            'bg-slate-900/85 text-slate-200 border-slate-700/80'
          }">
            ${geo.city ? geo.city.split(',')[0] : node.id}
            ${isRootCause ? '<span class="text-amber-400 ml-1">★ ROOT</span>' : ''}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "grid-node-icon",
        html: iconHtml,
        iconSize: [60, 40],
        iconAnchor: [30, 10]
      });

      const marker = L.marker([geo.lat, geo.lng], { icon: customIcon });

      const feats = node.features || {};
      const ci = (modelOutput.confidence_interval || {})[node.id] || [risk - 0.05, risk + 0.05];
      let roleLabel = "";
      if (isRootCause) roleLabel = `<div class="text-amber-400 font-bold mb-0.5">★ TRUE ROOT CAUSE ORIGIN</div>`;
      else if (isSymptom) roleLabel = `<div class="text-rose-400 font-bold mb-0.5">↳ DOWNSTREAM CASCADE SYMPTOM</div>`;

      marker.bindTooltip(`
        <div class="font-mono text-xs">
          <div class="flex justify-between items-center border-b border-slate-700 pb-1 mb-1">
            <b class="text-cyan-300">${node.id} — ${geo.name}</b>
            <span class="px-1.5 py-0.5 rounded text-[10px] ${risk > 0.7 ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'} font-bold">${(risk*100).toFixed(1)}% RISK</span>
          </div>
          ${roleLabel}
          <div class="text-[10px] text-slate-300">
            <span>City/Region: <b>${geo.city}</b></span><br/>
            <span>Loading: <b>${feats.load_pct || 84.2}%</b> &bull; Voltage: <b>${feats.voltage_pu || 0.972} pu</b></span><br/>
            <span>Temperature: <b>${feats.temperature_c || 71.0}°C</b> &bull; 90% CI: <b>[${(ci[0]*100).toFixed(0)}% – ${(ci[1]*100).toFixed(0)}%]</b></span>
          </div>
        </div>
      `, { direction: "top", offset: [0, -12] });

      marker.on("click", () => {
        focusNode(node.id);
      });

      state.markersLayer.addLayer(marker);
      state.markerInstances[node.id] = marker;
    });
  }

  /**
   * Focuses on an asset on the map and updates the inspector.
   */
  function focusNode(nodeId) {
    state.activeDatasetContext = null;
    state.selectedNodeId = nodeId;
    const node = state.currentGridState && (state.currentGridState.nodes || []).find(item => item.id === nodeId);
    const geo = node ? getNodeGeo(node) : GEO_COORDINATES[nodeId];
    if (geo && state.map) {
      state.map.setView([geo.lat, geo.lng], 8, { animate: true });
      const marker = state.markerInstances[nodeId];
      if (marker) marker.openTooltip();
    }

    updateInspectorPanel(nodeId);
    updateSignalChain(nodeId);
    if (state.currentGridState && state.currentModelOutput) {
      renderLeafletLayers(state.currentGridState, state.currentModelOutput);
    }
  }

  function updateSignalChain(nodeId) {
    const info = document.getElementById("signal-chain-info");
    if (!info || !state.currentGridState) return;
    const linked = (state.currentGridState.edges || []).filter((edge) => edge.source === nodeId || edge.target === nodeId);
    if (linked.length === 0) {
      info.innerText = `${nodeId}: no visible signal links in this view`;
      return;
    }
    info.innerText = `${nodeId} signal chain: ${linked.map((edge) => edge.source === nodeId ? edge.target : edge.source).join(" • ")}`;
  }

  function applyTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    document.body.classList.toggle("light-theme", state.theme === "light");
    const label = document.getElementById("btn-theme-text");
    const button = document.getElementById("btn-theme");
    if (label) label.innerText = state.theme === "dark" ? "Light Mode" : "Dark Mode";
    if (button) button.title = `Switch to ${state.theme === "dark" ? "light" : "dark"} map theme`;
  }

  function toggleTheme() {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("gridsense-theme", nextTheme);
    applyTheme(nextTheme);
  }

  /** Move the map to the selected city and draw its nearest grid context. */
  async function selectCity(city) {
    if (!city || !state.map) return;
    state.activeDatasetConditionId = null;

    const datasetCity = state.citiesById[city];
    if (datasetCity) {
      await showDatasetCity(datasetCity);
      return;
    }

    const entry = Object.entries(GEO_COORDINATES).find(([, geo]) =>
      geo.city.toLowerCase().includes(city.toLowerCase()) ||
      geo.name.toLowerCase().includes(city.toLowerCase())
    );

    if (!entry) return;
    const [nodeId, geo] = entry;
    state.map.flyTo([geo.lat, geo.lng], 9, { animate: true, duration: 0.8 });
    focusNode(nodeId);
  }

  async function showDatasetCity(city) {
    if (!state.map || !state.cityLayer) return;
    state.cityLayer.clearLayers();
    state.map.flyTo([city.lat, city.lon], 9, { animate: true, duration: 0.8 });

    const icon = L.divIcon({
      className: "grid-node-icon",
      html: `<div class="flex flex-col items-center"><div class="node-marker-body marker-healthy" style="width:22px;height:22px;border:2px solid #67e8f9;"><span style="font-size:10px;font-weight:800;color:#141414;">⌁</span></div><div class="mt-1 px-1.5 py-0.5 rounded bg-slate-950/95 text-cyan-200 border border-cyan-700 text-[9px] font-mono whitespace-nowrap">${city.city}</div></div>`,
      iconSize: [80, 44],
      iconAnchor: [40, 11]
    });
    const marker = L.marker([city.lat, city.lon], { icon }).addTo(state.cityLayer);
    marker.bindTooltip(`<div class="font-mono text-xs"><b class="text-cyan-300">${city.city}, ${city.state}</b><br/><span>Population: ${(city.population || 0).toLocaleString()}</span><br/><span class="text-emerald-400">Dataset city reference</span></div>`, { direction: "top", offset: [0, -12] }).openTooltip();
    try {
      const response = await fetch(`${API_BASE}/api/cities/${encodeURIComponent(city.city_id)}/grid-context?limit=9`);
      if (response.ok) drawCityGridContext(await response.json(), []);
    } catch (error) {
      console.warn("Nearest grid context unavailable.", error);
    }
  }

  async function focusCityContext(cityName, stateName) {
    try {
      state.activeDatasetConditionId = null;
      const response = await fetch(`${API_BASE}/api/cities?q=${encodeURIComponent(cityName)}&limit=8`);
      if (!response.ok) return;
      const cities = await response.json();
      const normalizedState = String(stateName || "").toLowerCase();
      const city = cities.find((item) => !normalizedState || String(item.state || "").toLowerCase() === normalizedState) || cities[0];
      if (!city) return;
      const selector = document.getElementById("citySelector");
      if (selector && city.city_id) selector.value = city.city_id;
      await showDatasetCity(city);
    } catch (error) { console.warn("Nearest city grid context unavailable.", error); }
  }

  // Local dataset assets are connected as a proximity context so a city focus
  // never leaves the operator looking at an unrelated Nashik network.
  function drawCityGridContext(context, criticalIds) {
    if (!state.cityContextLayer || !state.map) return;
    state.cityContextLayer.clearLayers();
    const assets = context.assets || [];
    const critical = new Set(criticalIds || []);
    const city = context.city || {};
    const points = assets.filter((asset) => Number.isFinite(Number(asset.lat)) && Number.isFinite(Number(asset.lon)));
    if (!points.length) return;
    const hub = [Number(city.lat), Number(city.lon)];
    points.forEach((asset) => {
      const isCritical = critical.has(asset.id);
      const color = isCritical ? "#f43f5e" : "#22c55e";
      L.polyline([hub, [Number(asset.lat), Number(asset.lon)]], { color, weight: isCritical ? 4 : 2, opacity: .78, dashArray: isCritical ? "8, 5" : "4, 5" }).addTo(state.cityContextLayer);
      const icon = L.divIcon({ className: "grid-node-icon", html: `<div class="flex flex-col items-center"><div class="node-marker-body ${isCritical ? "marker-critical" : "marker-healthy"}" style="width:22px;height:22px;"><span style="font-size:8px;font-weight:800;color:#141414;">${String(asset.type || "A").slice(0, 1).toUpperCase()}</span></div><div class="mt-1 px-1 py-0.5 rounded ${isCritical ? "bg-rose-950/95 text-rose-100 border-rose-700" : "bg-emerald-950/95 text-emerald-100 border-emerald-700"} border text-[8px] font-mono whitespace-nowrap">${asset.type} · ${asset.voltage_kv}kV</div></div>`, iconSize: [95, 42], iconAnchor: [47, 11] });
      const marker = L.marker([Number(asset.lat), Number(asset.lon)], { icon }).addTo(state.cityContextLayer);
      marker.bindTooltip(`<div class="font-mono text-xs"><b>${asset.id}</b><br/><span>${asset.type} near ${city.city}, ${city.state}</span><br/><span>${isCritical ? "CRITICAL CONDITION PATH" : "STABLE LOCAL CONTEXT"}</span></div>`);
      marker.on("click", () => updateDatasetInspector(asset, city, isCritical));
    });
    updateDatasetInspector(points[0], city, critical.has(points[0].id));
  }

  function updateDatasetInspector(asset, city, isCritical, isLiveRefresh = false) {
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
    // Dataset topology supplies physical station metadata, not a SCADA stream.
    // Derive stable demo telemetry from each station identity so every random
    // city and every custom/dataset context has meaningful, changing details.
    const telemetry = deriveContextTelemetry(asset, city, isCritical);
    state.activeDatasetContext = { asset, city, isCritical };
    setText("ins-asset-name", `${asset.id} — nearest ${asset.type}`);
    setText("ins-location", `${city.city}, ${city.state} • ${(asset.type || "asset").toUpperCase()}`);
    setText("ins-load", `${telemetry.load_pct}%`);
    setText("ins-volt", `${telemetry.voltage_pu} pu`);
    setText("ins-temp", `${telemetry.temperature_c} °C`);
    setText("ins-ttc", `${telemetry.time_to_critical_hours} hrs`);
    const badge = document.getElementById("ins-status-badge");
    const status = isCritical || telemetry.risk > .7 ? "critical" : telemetry.risk > .35 ? "warning" : "stable";
    if (badge) { badge.className = `px-2 py-0.5 rounded text-[10px] font-mono font-bold ${status === "critical" ? "bg-rose-950 text-rose-300 border border-rose-800" : status === "warning" ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"}`; badge.innerText = status === "critical" ? "CRITICAL PATH" : status === "warning" ? "WARNING" : "STABLE CONTEXT"; }
    renderSparkline({ features: { voltage_pu: telemetry.voltage_pu } }, telemetry.risk);
    setMitigationStatus(status, asset.id);
  }

  function deriveContextTelemetry(asset, city, isCritical) {
    const seed = `${asset.id}|${city.city}|${city.state}`.split("").reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7);
    const phase = (seed % 628) / 100;
    const pulse = Math.sin(Date.now() / 4200 + phase);
    const load = 48 + (seed % 42) + pulse * 4.8;
    const temperature = 36 + ((seed >>> 5) % 34) + pulse * 1.7;
    const voltage = Number((0.985 - Math.max(0, load - 72) * .0011 - Math.max(0, temperature - 57) * .0007).toFixed(3));
    const risk = isCritical ? .82 : Math.min(.76, Math.max(.08, (load - 54) / 58 + Math.max(0, temperature - 52) / 96 + Math.max(0, .975 - voltage) * 8));
    return { load_pct: Number(load.toFixed(1)), voltage_pu: voltage, temperature_c: Number(temperature.toFixed(1)), time_to_critical_hours: Number(Math.max(2.4, 26 - risk * 23).toFixed(1)), risk };
  }

  function setMitigationStatus(status, assetId) {
    const copy = {
      critical: { label: "CRITICAL", note: `Immediate repair required at ${assetId}. Isolate the affected path, dispatch a repair crew, and keep the load curtailed until inspection clears it.`, tone: "rose" },
      warning: { label: "WARNING", note: `${assetId} is approaching critical limits. Increase telemetry sampling, prepare a repair crew, and rebalance load before escalation.`, tone: "amber" },
      stable: { label: "STABLE", note: `${assetId} is in good operating condition. Continue standard monitoring; no repair action is required.`, tone: "emerald" }
    }[status] || { label: "STABLE", note: "Grid context is stable.", tone: "emerald" };
    const text = document.getElementById("mitigation-status-copy");
    const selected = document.getElementById("mitigation-status-label");
    if (text) text.innerText = copy.note;
    if (selected) { selected.innerText = copy.label; selected.className = `text-[10px] font-mono font-bold text-${copy.tone}-300`; }
    ["critical", "warning", "stable"].forEach((name) => document.getElementById(`mitigation-${name}`)?.classList.toggle("ring-1", name === status));
  }

  async function searchNode() {
    const query = document.getElementById("mapSearch").value.trim().toLowerCase();
    if (!query) return;

    // 1. Search Core Grid Assets
    for (const [nid, geo] of Object.entries(GEO_COORDINATES)) {
      if (nid.toLowerCase() === query || geo.name.toLowerCase().includes(query) || geo.city.toLowerCase().includes(query)) {
        focusNode(nid);
        return;
      }
    }

    // 2. Search 20,000+ Indian Cities Dataset via Backend
    try {
      const res = await fetch(`${API_BASE}/api/cities?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const cities = await res.json();
        if (cities && cities.length > 0) {
          const match = cities[0];
          if (match.city_id) {
            await showDatasetCity(match);
            const selector = document.getElementById("citySelector");
            if (selector) selector.value = match.city_id;
            return;
          }
          if (match.lat && match.lon && state.map) {
            state.map.setView([match.lat, match.lon], 9, { animate: true });
            
            const cityIcon = L.divIcon({
              className: "grid-node-icon",
              html: `
                <div class="node-marker-body marker-healthy animate-bounce" style="width:20px;height:20px;border:2px solid #06b6d4;" title="${match.city}">
                  <span style="font-size:9px;font-weight:bold;color:#141414;">★</span>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            const marker = L.marker([match.lat, match.lon], { icon: cityIcon }).addTo(state.markersLayer);
            marker.bindTooltip(`
              <div class="font-mono text-xs">
                <b class="text-cyan-300">${match.city}, ${match.state}</b><br/>
                <span class="text-[10px] text-slate-300">Population: <b>${(match.population || 0).toLocaleString()}</b></span><br/>
                <span class="text-[10px] text-emerald-400">National 20k Grid Asset Node</span>
              </div>
            `, { permanent: true, direction: "top" }).openTooltip();
          }
        }
      }
    } catch (err) {
      console.warn("City search fallback:", err);
    }
  }

  function filterMarkers() {
    if (state.currentGridState && state.currentModelOutput) {
      renderLeafletLayers(state.currentGridState, state.currentModelOutput);
    }
  }

  function selectCategory(type) {
    const filter = document.getElementById("mapTypeFilter");
    if (filter) filter.value = type;
    filterMarkers();
    setTimeout(fitAllBounds, 0);
  }

  function fitAllBounds() {
    if (state.markersLayer && state.markersLayer.getLayers().length > 0) {
      state.map.fitBounds(state.markersLayer.getBounds(), { padding: [30, 30] });
    }
  }

  /** Selects a different tested condition and its closest dataset city in one action. */
  async function randomizeDatasetContext() {
    const button = document.querySelector('[onclick="GridApp.randomizeDatasetContext()"]');
    if (button) button.innerText = "Loading…";
    try {
      if (state.conditions.length) {
        const connected = state.conditions.filter((item) => String(item.cascade_path || "").split("|").filter(Boolean).length > 1);
        const candidates = connected.length ? connected : state.conditions;
        const condition = candidates[Math.floor(Math.random() * candidates.length)];
        const selector = document.getElementById("mapScenarioFilter");
        if (selector) selector.value = condition.id;
        await switchScenario(condition.id);
        return;
      }
      const nodes = state.currentGridState?.nodes || [];
      if (nodes.length) focusNode(nodes[Math.floor(Math.random() * nodes.length)].id);
    } finally {
      if (button) button.innerText = "Randomize";
    }
  }

  /**
   * Updates the Selected Asset Inspector Panel with required exact fields:
   * LOADING: 84.2%, VOLTAGE: 0.972 pu, TEMPERATURE: 71.0 °C, TIME TO CRITICAL: 6.2 hrs, and Alert status.
   */
  function updateInspectorPanel(nodeId) {
    if (!state.currentGridState || !state.currentModelOutput) return;

    const node = (state.currentGridState.nodes || []).find(n => n.id === nodeId);
    if (!node) return;

    const geo = getNodeGeo(node) || { name: nodeId, city: "Regional Grid", category: "Transformer" };
    const feats = node.features || {};
    const risk = (state.currentModelOutput.node_risk || {})[nodeId] || 0.1;
    const ttc = (state.currentModelOutput.time_to_critical_hours || {})[nodeId];

    document.getElementById("ins-asset-name").innerText = `${nodeId} — ${geo.name}`;
    document.getElementById("ins-location").innerText = `${geo.city} • ${geo.category.toUpperCase()}`;
    document.getElementById("ins-load").innerText = `${feats.load_pct}%`;
    document.getElementById("ins-volt").innerText = `${feats.voltage_pu} pu`;
    document.getElementById("ins-temp").innerText = `${feats.temperature_c} °C`;
    document.getElementById("ins-ttc").innerText = Number.isFinite(ttc) ? `${ttc} hrs` : "—";

    const statusBadge = document.getElementById("ins-status-badge");
    if (statusBadge) {
      if (risk > 0.70) {
        statusBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800";
        statusBadge.innerText = "CRITICAL ALERT";
      } else if (risk > 0.30) {
        statusBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800";
        statusBadge.innerText = "ALERT";
      } else {
        statusBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800";
        statusBadge.innerText = "ONLINE";
      }
    }

    renderSparkline(node, risk);
  }

  function renderSparkline(node, risk) {
    const ctx = document.getElementById("insSparkline");
    if (!ctx) return;

    if (state.sparklineChart) {
      state.sparklineChart.destroy();
    }

    const vBase = node.features.voltage_pu || 0.98;
    const dataPoints = [];
    for (let h = 0; h < 24; h += 3) {
      const drop = (h >= 12 && h <= 18) ? (risk * 0.08) : 0.01;
      dataPoints.push(Number((vBase - drop + (Math.random() * 0.01 - 0.005)).toFixed(3)));
    }

    state.sparklineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["00h", "03h", "06h", "09h", "12h", "15h", "18h", "21h"],
        datasets: [{
          data: dataPoints,
          borderColor: risk > 0.7 ? "#ef4444" : "#06b6d4",
          backgroundColor: risk > 0.7 ? "rgba(239, 68, 68, 0.15)" : "rgba(6, 182, 212, 0.15)",
          borderWidth: 1.5,
          tension: 0.3,
          fill: true,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 8 }, color: "#A8A8A6" }, grid: { display: false } },
          y: { min: 0.85, max: 1.05, ticks: { font: { size: 8 }, color: "#A8A8A6" }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  }

  function updateMetricsAndPanels(gridState, modelOutput) {
    const cascadeRisk = modelOutput.cascade_risk_pct || 12.0;
    const rootCauses = modelOutput.root_cause_ranking || [];
    const nodeRisks = modelOutput.node_risk || {};

    const meterEl = document.getElementById("cascade-risk-meter");
    if (meterEl) {
      meterEl.innerText = `${cascadeRisk.toFixed(1)}%`;
      meterEl.className = `px-2 py-0.5 rounded font-bold text-xs ${cascadeRisk > 60 ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`;
    }

    const headerStatus = document.getElementById("header-status-badge");
    const footerStability = document.getElementById("footer-stability");
    if (cascadeRisk > 60) {
      if (headerStatus) {
        headerStatus.innerText = "CASCADE ALERT";
        headerStatus.className = "px-2 py-0.5 rounded text-[11px] font-bold badge-critical";
      }
      if (footerStability) {
        footerStability.innerText = `${(100 - cascadeRisk).toFixed(1)}% AT RISK`;
        footerStability.className = "text-sm font-extrabold text-rose-400";
      }
    } else {
      if (headerStatus) {
        const health = Number(gridState.overall_health_pct || 100).toFixed(1);
        headerStatus.innerText = `${health}% STABLE`;
        headerStatus.className = "px-2 py-0.5 rounded text-[11px] font-bold badge-healthy";
      }
      if (footerStability) {
        footerStability.innerText = `${Number(gridState.overall_health_pct || 100).toFixed(1)}% STABLE`;
        footerStability.className = "text-sm font-extrabold text-emerald-400";
      }
    }

    // Cascade Path Pills
    const pathPillsContainer = document.getElementById("cascade-path-pills");
    const cascadePath = modelOutput.cascade_path || [];
    if (pathPillsContainer) {
      if (cascadePath.length > 0) {
        pathPillsContainer.innerHTML = cascadePath.map((nid, idx) => {
          const isOrigin = idx === 0;
          const bgClass = isOrigin ? "bg-amber-950 text-amber-300 border border-amber-700 font-bold" : "bg-rose-950 text-rose-300 border border-rose-800";
          const arrow = idx < cascadePath.length - 1 ? `<i data-lucide="arrow-right" class="w-3 h-3 text-slate-500 inline mx-1"></i>` : "";
          return `<span class="px-2 py-0.5 rounded ${bgClass}">${nid}${isOrigin ? ' (Origin)' : ''}</span>${arrow}`;
        }).join("");
      } else {
        pathPillsContainer.innerHTML = `<span class="text-emerald-400 font-mono">No active cascade propagation.</span>`;
      }
      if (window.lucide) lucide.createIcons();
    }

    // Root Cause vs Symptom Panel
    const topRc = rootCauses.find(rc => !rc.explained_by_upstream) || rootCauses[0];
    if (topRc) {
      const rcNodeEl = document.getElementById("rc-node-id");
      const rcScoreEl = document.getElementById("rc-score-badge");
      const rootNodeId = topRc.node || topRc.node_id || state.selectedNodeId;
      // Older scenario fixtures omit attribution score.  Derive a meaningful
      // value from the model risk instead of rendering an untrustworthy NaN.
      const rawScore = Number(topRc.root_cause_score);
      const rootScore = Number.isFinite(rawScore)
        ? rawScore
        : Number((modelOutput.node_risk || {})[rootNodeId]) || 0;
      if (rcNodeEl) rcNodeEl.innerText = `${rootNodeId} — TRUE ROOT CAUSE`;
      if (rcScoreEl) rcScoreEl.innerText = `${Math.round(rootScore * 100)}% Score`;
    }

    const rec = modelOutput.recommended_intervention || {
      action: "Reduce T17 load by 12%, redistribute active power across tie lines to T14 and T19.",
      target_node: "T17",
      load_shed_pct: 12.0
    };
    const recDescEl = document.getElementById("intervene-action-desc");
    if (recDescEl) recDescEl.innerText = rec.action;
  }

  async function runCustomSimulation() {
    state.isSimulating = true;
    const btn = document.getElementById("btn-simulate");
    if (btn) btn.innerHTML = `<span class="animate-spin">⌛</span> <span>Simulating...</span>`;

    const stress = parseFloat(document.getElementById("slider-stress").value);

    try {
      const resp = await fetch(`${API_BASE}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiating_node: "T17",
          stress_multiplier: stress,
          ambient_temp_c: 35.0,
          max_steps: 6
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        renderState(data.grid_state, data.model_output);
        focusNode("T17");
      }
    } catch (err) {
      console.error("Simulation error", err);
    } finally {
      state.isSimulating = false;
      if (btn) btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> <span>Run simulation</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  async function applyIntervention() {
    try {
      const resp = await fetch(`${API_BASE}/api/intervene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiating_node: "T17",
          stress_multiplier: 1.85,
          ambient_temp_c: 35.0,
          load_shed_pct: 12.0
        })
      });

      if (resp.ok) {
        const result = await resp.json();
        const beforeRisk = result.before.model_output.cascade_risk_pct;
        const afterRisk = result.after.model_output.cascade_risk_pct;

        document.getElementById("meter-before-val").innerText = `${beforeRisk.toFixed(0)}% RISK`;
        document.getElementById("meter-after-val").innerText = `${afterRisk.toFixed(0)}% RISK`;

        renderState(result.after.grid_state, result.after.model_output);
        highlightPitchStep(8);
        document.getElementById("demo-step-text").innerText = `8. Result: "Cascade risk drops from ${beforeRisk.toFixed(0)}% to ${afterRisk.toFixed(0)}%. That's actionable decision-making."`;
      }
    } catch (e) {
      console.error("Intervention error", e);
    }
  }

  function loadScenarioData(scenario) {
    if (scenario.before) {
      renderState(scenario.before.grid_state, scenario.before.model_output);
      document.getElementById("meter-before-val").innerText = `${scenario.before.model_output.cascade_risk_pct.toFixed(0)}% RISK`;
      document.getElementById("meter-after-val").innerText = `${scenario.after.model_output.cascade_risk_pct.toFixed(0)}% RISK`;
    } else if (scenario.grid_state && scenario.model_output) {
      renderState(scenario.grid_state, scenario.model_output);
    }
    focusNode("T17");
  }

  async function resetHealthy() {
    try {
      const resp = await fetch(`${API_BASE}/api/scenarios/scenario_normal`);
      if (resp.ok) {
        const data = await resp.json();
        loadScenarioData(data);
        highlightPitchStep(1);
        document.getElementById("demo-step-text").innerText = `1. Normal state: "Here's a live grid — 33 nodes, all healthy, cascade risk 3%."`;
        fitAllBounds();
      }
    } catch (e) {
      console.error("Reset error", e);
    }
  }

  async function runPitchStep(stepNumber) {
    highlightPitchStep(stepNumber);

    switch (stepNumber) {
      case 1:
        await resetHealthy();
        break;
      case 2:
        document.getElementById("slider-stress").value = 1.85;
        document.getElementById("label-stress-val").innerText = "1.85x (+85%)";
        document.getElementById("demo-step-text").innerText = `2. Introduce stress: "We spike demand at Substation T17 using the what-if slider."`;
        await runCustomSimulation();
        break;
      case 3:
        document.getElementById("demo-step-text").innerText = `3. Early prediction: "Before anything trips, GridSense flags T17 at 86% failure risk — hours ahead."`;
        focusNode("T17");
        break;
      case 4:
        document.getElementById("demo-step-text").innerText = `4. Why: "Temperature (+31%), Load growth (+27%), and Neighbor transfer (+22%) are top factors."`;
        focusNode("T17");
        break;
      case 5:
        document.getElementById("demo-step-text").innerText = `5. Root cause, not symptom: "T17 and F8 show elevated risk. GridSense isolates T17 as the true origin."`;
        focusNode("T17");
        break;
      case 6:
        document.getElementById("demo-step-text").innerText = `6. Cascade path: "Predicted propagation path T17 -> F8 -> S4 with 86% regional risk."`;
        state.showCascadePath = true;
        if (state.currentGridState && state.currentModelOutput) {
          renderLeafletLayers(state.currentGridState, state.currentModelOutput);
        }
        fitAllBounds();
        break;
      case 7:
        document.getElementById("demo-step-text").innerText = `7. Intervention: "Recommended action: reduce T17 load by 12%, redistribute to T14 and T19."`;
        break;
      case 8:
        await applyIntervention();
        break;
    }
  }

  function nextPitchStep() {
    state.currentPitchStep = (state.currentPitchStep % 8) + 1;
    runPitchStep(state.currentPitchStep);
  }

  function highlightPitchStep(stepNum) {
    state.currentPitchStep = stepNum;
    const pills = document.querySelectorAll(".step-pill");
    pills.forEach((p, idx) => {
      if (idx === stepNum - 1) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });
  }

  function toggleCascadePath() {
    state.showCascadePath = !state.showCascadePath;
    const btn = document.getElementById("toggle-path");
    if (btn) {
      if (state.showCascadePath) {
        btn.className = "px-2 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900 transition flex items-center space-x-1";
      } else {
        btn.className = "px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750 transition flex items-center space-x-1";
      }
    }
    if (state.currentGridState && state.currentModelOutput) {
      renderLeafletLayers(state.currentGridState, state.currentModelOutput);
    }
  }

  async function switchScenario(scenarioId) {
    if (!scenarioId) return;
    try {
      const resp = await fetch(`${API_BASE}/api/scenarios/${scenarioId}`);
      if (resp.ok) {
        const scenarioData = await resp.json();
        state.scenarios[scenarioId] = scenarioData;
        if (scenarioData.scenario_id) {
          await loadDatasetCondition(scenarioData);
        } else {
          loadScenarioData(scenarioData);
        }
        if (state.map && !scenarioData.scenario_id) fitAllBounds();
      }
    } catch (e) {
      console.warn("Failed to load scenario", scenarioId, e);
    }
  }

  async function loadDatasetCondition(condition) {
    const gridState = state.currentGridState || buildOfflineBaseline();
    const cascadePath = String(condition.cascade_path || "").split("|").filter(Boolean);
    const cascadeRisk = Number(condition.cascade_risk_pct || 0);
    const initiatingNode = condition.initiating_node || cascadePath[0] || "T17";
    state.activeDatasetConditionId = condition.scenario_id || condition.id || "dataset-condition";
    state.selectedNodeId = initiatingNode;
    const modelOutput = {
      ...buildOfflinePrediction(),
      cascade_risk_pct: cascadeRisk,
      cascade_path: cascadePath,
      root_cause_ranking: [{ node: initiatingNode, node_id: initiatingNode, explained_by_upstream: false }]
    };

    renderState(gridState, modelOutput);
    const conditionText = document.getElementById("demo-step-text");
    if (conditionText) {
      conditionText.innerText = `Dataset condition ${condition.scenario_id}: ${condition.scenario_type} in ${condition.initiating_city}, ${condition.initiating_state}. Recorded cascade risk: ${cascadeRisk.toFixed(2)}%.`;
    }

    const city = Object.values(state.citiesById).find((entry) =>
      String(entry.city).toLowerCase() === String(condition.initiating_city).toLowerCase() &&
      String(entry.state).toLowerCase() === String(condition.initiating_state).toLowerCase()
    );
    if (city) {
      const citySelector = document.getElementById("citySelector");
      if (citySelector) citySelector.value = city.city_id;
      await showDatasetCity(city);
    }

    try {
      const response = await fetch(`${API_BASE}/api/assessments/${condition.scenario_id}`);
      if (!response.ok) throw new Error(`Assessment request failed (${response.status})`);
      const assessment = await response.json();
      renderGnnAssessment(assessment);
      if (city) {
        const contextResponse = await fetch(`${API_BASE}/api/cities/${encodeURIComponent(city.city_id)}/grid-context?limit=9`);
        if (contextResponse.ok) {
          const context = await contextResponse.json();
          const nearestIds = (context.assets || []).slice(0, 3).map((asset) => asset.id);
          const visibleCritical = cascadePath.some((id) => nearestIds.includes(id)) ? cascadePath : (cascadeRisk >= 30 ? nearestIds : []);
          drawCityGridContext(context, visibleCritical);
        }
      }
    } catch (error) {
      console.warn("Detailed GNN assessment unavailable.", error);
    }
  }

  function renderGnnAssessment(assessment) {
    const panel = document.getElementById("gnn-assessment-panel");
    const risk = document.getElementById("gnn-assessment-risk");
    const node = document.getElementById("gnn-assessment-node");
    const optimization = document.getElementById("gnn-assessment-optimization");
    const basis = document.getElementById("gnn-assessment-basis");
    const reasoning = document.getElementById("gnn-assessment-reasoning");
    if (!panel || !risk || !node || !optimization || !basis || !reasoning) return;

    const gnn = assessment.gnn_assessment || {};
    const topNode = (gnn.top_risk_nodes || [])[0];
    const plan = assessment.optimization || {};
    panel.classList.remove("hidden");
    risk.innerText = `${Number(gnn.cascade_risk_pct || 0).toFixed(1)}% cascade risk`;
    node.innerText = topNode ? `${topNode.node_id} · ${(Number(topNode.risk) * 100).toFixed(1)}%` : "No elevated node";
    optimization.innerText = plan.transformers_after
      ? `${plan.transformers_before} → ${plan.transformers_after} transformers · ${plan.topology_structure}`
      : "No alternative available";
    const metrics = plan.metric_basis || {};
    basis.innerText = `Decision basis: peak load ${Number(metrics.max_load_pct || 0).toFixed(1)}% · minimum voltage ${Number(metrics.min_voltage_pu || 0).toFixed(3)} pu · max temperature ${Number(metrics.max_temperature_c || 0).toFixed(1)}°C · ${plan.dispatch_action || "no action"}`;
    reasoning.innerText = `${plan.reasoning_engine || "Optimization reasoning"}: ${(plan.reasoning || ["No constraint explanation available."]).join(" ")}`;
    drawDatasetCascadePath(assessment.cascade_path_assets || []);
  }

  function drawDatasetCascadePath(assets) {
    if (!state.conditionPathLayer || !state.map) return;
    state.conditionPathLayer.clearLayers();
    const points = assets.filter((asset) => Number.isFinite(Number(asset.lat)) && Number.isFinite(Number(asset.lon)));
    if (points.length < 2) return;

    const latlngs = points.map((asset) => [Number(asset.lat), Number(asset.lon)]);
    L.polyline(latlngs, {
      color: "#f43f5e",
      weight: 5,
      opacity: 0.95,
      dashArray: "9, 6",
      className: "signal-chain-line"
    }).addTo(state.conditionPathLayer);

    points.forEach((asset) => {
      const icon = L.divIcon({
        className: "grid-node-icon",
        html: `<div class="flex flex-col items-center"><div class="node-marker-body marker-critical" style="width:22px;height:22px;"><span style="font-size:9px;font-weight:800;color:#141414;">${asset.sequence}</span></div><div class="mt-1 px-1 py-0.5 rounded bg-rose-950/95 text-rose-100 border border-rose-700 text-[8px] font-mono whitespace-nowrap">${asset.type} · ${asset.voltage_kv}kV</div></div>`,
        iconSize: [95, 42],
        iconAnchor: [47, 11]
      });
      const marker = L.marker([Number(asset.lat), Number(asset.lon)], { icon }).addTo(state.conditionPathLayer);
      marker.bindTooltip(`<div class="font-mono text-xs"><b class="text-rose-300">#${asset.sequence} ${asset.id}</b><br/><span>${asset.type} · ${asset.city}, ${asset.state}</span><br/><span>${asset.voltage_kv} kV · ${asset.capacity_mva} MVA</span></div>`, { direction: "top", offset: [0, -12] });
    });
    state.map.fitBounds(L.latLngBounds(latlngs), { padding: [45, 45], maxZoom: 8 });
  }

  return {
    init,
    runCustomSimulation,
    applyIntervention,
    resetHealthy,
    focusNode,
    selectCity,
    searchNode,
    filterMarkers,
    selectCategory,
    fitAllBounds,
    toggleLiveStream,
    toggleTheme,
    toggleCascadePath,
    randomizeDatasetContext,
    filterConditionMenu,
    selectSearchedCondition,
    focusRealtimeTransformer,
    focusCityContext,
    setMitigationStatus,
    switchScenario,
    runPitchStep,
    nextPitchStep
  };
})();

// Auto-run on DOM load
window.addEventListener("DOMContentLoaded", () => {
  GridApp.init();
});
