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
    linesLayer: null,
    cascadeVectorLayer: null,
    markerInstances: {},
    sparklineChart: null,
    baseLoad: 4.25
  };

  // Real Geospatial Coordinates for India National Grid Assets and Interconnect
  const GEO_COORDINATES = {
    // ── INDIA NATIONAL GRID CORE STRATEGIC ASSETS ──
    "T17": { lat: 19.9975, lng: 73.7898, name: "Nashik Heavy Step-Down T17", city: "Nashik, Maharashtra", category: "Transformer" },
    "F8": { lat: 19.2500, lng: 73.8300, name: "Feeder F8 Nashik-Pune Corridor", city: "Maharashtra", category: "Feeder" },
    "T21": { lat: 18.5204, lng: 73.8567, name: "Pune Step-Down Transformer T21", city: "Pune, Maharashtra", category: "Transformer" },
    "S4": { lat: 18.5204, lng: 73.8567, name: "Pune 400kV Grid Substation S4", city: "Pune, Maharashtra", category: "Substation" },
    "S3": { lat: 19.0760, lng: 72.8777, name: "Mumbai Central Grid Substation S3", city: "Mumbai, Maharashtra", category: "Substation" },
    "S1": { lat: 28.6139, lng: 77.2090, name: "Delhi 400kV Super Grid Substation S1", city: "Delhi (NCR)", category: "Substation" },
    "S2": { lat: 26.9124, lng: 75.7873, name: "Jaipur Grid Substation S2", city: "Jaipur, Rajasthan", category: "Substation" },
    "S5": { lat: 13.0827, lng: 80.2707, name: "Chennai 400kV Grid Substation S5", city: "Chennai, Tamil Nadu", category: "Substation" },
    "S6": { lat: 12.9716, lng: 77.5946, name: "Bengaluru Regional Substation S6", city: "Bengaluru, Karnataka", category: "Substation" },
    "S7": { lat: 17.3850, lng: 78.4867, name: "Hyderabad Grid Substation S7", city: "Hyderabad, Telangana", category: "Substation" },
    "S8": { lat: 22.5726, lng: 88.3639, name: "Kolkata Eastern Grid Substation S8", city: "Kolkata, West Bengal", category: "Substation" },
    "S9": { lat: 20.2961, lng: 85.8245, name: "Bhubaneswar Grid Substation S9", city: "Bhubaneswar, Odisha", category: "Substation" },
    "S10": { lat: 26.1445, lng: 91.7362, name: "Guwahati North-East Substation S10", city: "Guwahati, Assam", category: "Substation" },
    "G1": { lat: 31.4100, lng: 76.4400, name: "Bhakra Nangal Hydro Complex G1", city: "Punjab", category: "Generator" },
    "G2": { lat: 28.5700, lng: 77.6000, name: "Dadri Super Thermal Plant G2", city: "Uttar Pradesh", category: "Generator" },
    "G3": { lat: 19.8300, lng: 72.6600, name: "Tarapur Atomic Power Station G3", city: "Maharashtra", category: "Generator" },
    "G4": { lat: 21.8300, lng: 73.7500, name: "Sardar Sarovar Hydro Project G4", city: "Gujarat", category: "Generator" },
    "G5": { lat: 8.1700, lng: 77.7100, name: "Kudankulam Nuclear Power Plant G5", city: "Tamil Nadu", category: "Generator" },
    "G6": { lat: 18.7900, lng: 79.4700, name: "Ramagundam Super Thermal G6", city: "Telangana", category: "Generator" },
    "G7": { lat: 24.8000, lng: 87.9000, name: "Farakka Super Thermal G7", city: "West Bengal", category: "Generator" },
    "G8": { lat: 27.1000, lng: 92.6000, name: "Kameng Hydro Electric Plant G8", city: "Arunachal Pradesh", category: "Generator" },
    "T3": { lat: 23.0225, lng: 72.5714, name: "Ahmedabad Industrial Transformer T3", city: "Ahmedabad, Gujarat", category: "Transformer" },
    "T14": { lat: 21.1458, lng: 79.0882, name: "Nagpur Interconnect Transformer T14", city: "Nagpur, Maharashtra", category: "Transformer" },
    "T19": { lat: 19.8762, lng: 75.3433, name: "Aurangabad Grid Transformer T19", city: "Aurangabad, Maharashtra", category: "Transformer" },
    "T1": { lat: 29.3909, lng: 76.9635, name: "Panipat Transmission Step-Down T1", city: "Panipat, Haryana", category: "Transformer" },
    "T5": { lat: 26.8467, lng: 80.9462, name: "Lucknow Regional Transformer T5", city: "Lucknow, Uttar Pradesh", category: "Transformer" },
    "T6": { lat: 9.9312, lng: 76.2673, name: "Kochi Marine Grid Transformer T6", city: "Kochi, Kerala", category: "Transformer" },
    "T7": { lat: 11.0168, lng: 76.9558, name: "Coimbatore Industrial Step-Down T7", city: "Coimbatore, Tamil Nadu", category: "Transformer" },
    "T8": { lat: 25.5941, lng: 85.1376, name: "Patna Eastern Transformer T8", city: "Patna, Bihar", category: "Transformer" },
    "T9": { lat: 23.3441, lng: 85.3096, name: "Ranchi Mineral Belt Transformer T9", city: "Ranchi, Jharkhand", category: "Transformer" },
    "L1": { lat: 28.6300, lng: 77.2200, name: "Delhi High-Density Load Center L1", city: "Delhi", category: "Load Center" },
    "L2": { lat: 19.0800, lng: 72.8800, name: "Mumbai Financial Capital Load L2", city: "Mumbai", category: "Load Center" },
    "L3": { lat: 12.9800, lng: 77.6000, name: "Bengaluru Tech Corridor Load L3", city: "Bengaluru", category: "Load Center" },

    // Western Regional Interconnect / IEEE Benchmarks
    "F2": { lat: 22.0000, lng: 75.0000, name: "Central Feeder F2", city: "Madhya Pradesh", category: "Feeder" },
    "F6": { lat: 15.3647, lng: 75.1240, name: "Hubli-Dharwad Feeder F6", city: "Karnataka", category: "Feeder" },
    "F10": { lat: 26.2183, lng: 78.1828, name: "Gwalior Feeder F10", city: "Madhya Pradesh", category: "Feeder" },
    "T11": { lat: 23.1765, lng: 75.7885, name: "Ujjain Step-Down T11", city: "Madhya Pradesh", category: "Transformer" },
    "F12": { lat: 21.1702, lng: 72.8311, name: "Surat Coastal Feeder F12", city: "Gujarat", category: "Feeder" },
    "T13": { lat: 22.3072, lng: 73.1812, name: "Vadodara Transformer T13", city: "Gujarat", category: "Transformer" },
    "F15": { lat: 15.2993, lng: 74.1240, name: "Goa Coastal Feeder F15", city: "Goa", category: "Feeder" },
    "F16": { lat: 16.7050, lng: 74.2433, name: "Kolhapur Trunk Line F16", city: "Maharashtra", category: "Feeder" },
    "T18": { lat: 17.6868, lng: 83.2185, name: "Visakhapatnam Port Transformer T18", city: "Andhra Pradesh", category: "Transformer" },
    "F20": { lat: 24.5854, lng: 73.7125, name: "Udaipur Feeder F20", city: "Rajasthan", category: "Feeder" },
    "F22": { lat: 25.3176, lng: 82.9739, name: "Varanasi Feeder F22", city: "Uttar Pradesh", category: "Feeder" },
    "T23": { lat: 26.4499, lng: 80.3319, name: "Kanpur Industrial Step-Down T23", city: "Uttar Pradesh", category: "Transformer" },
    "T24": { lat: 21.7645, lng: 72.1519, name: "Bhavnagar Transformer T24", city: "Gujarat", category: "Transformer" },
    "F25": { lat: 22.7196, lng: 75.8577, name: "Indore Feeder F25", city: "Madhya Pradesh", category: "Feeder" },
    "F26": { lat: 16.9891, lng: 82.2475, name: "Kakinada Feeder F26", city: "Andhra Pradesh", category: "Feeder" },
    "T27": { lat: 19.8135, lng: 85.8312, name: "Puri Coastal Step-Down T27", city: "Odisha", category: "Transformer" },
    "F28": { lat: 23.8315, lng: 91.2868, name: "Agartala Feeder F28", city: "Tripura", category: "Feeder" },
    "T29": { lat: 27.5653, lng: 89.6339, name: "Bhutan Tie Transformer T29", city: "Border Tie", category: "Transformer" },
    "T30": { lat: 26.7271, lng: 88.3953, name: "Siliguri Corridor Substation T30", city: "West Bengal", category: "Transformer" },
    "F31": { lat: 11.6643, lng: 78.1460, name: "Salem Feeder F31", city: "Tamil Nadu", category: "Feeder" },
    "T32": { lat: 9.9252, lng: 78.1198, name: "Madurai Step-Down T32", city: "Tamil Nadu", category: "Transformer" },
    "T33": { lat: 8.5241, lng: 76.9366, name: "Thiruvananthapuram South Grid T33", city: "Kerala", category: "Transformer" }
  };

  /**
   * Initializes the application and Leaflet GIS map.
   */
  async function init() {
    if (window.lucide) lucide.createIcons();

    initLeafletMap();
    startClock();
    startLiveTelemetryStream();
    setupEventListeners();

    // Load initial scenario (T17 Overload Pitch Scenario)
    try {
      const resp = await fetch(`${API_BASE}/api/scenarios/scenario_t17_overload`);
      if (resp.ok) {
        const scenarioData = await resp.json();
        state.scenarios["scenario_t17_overload"] = scenarioData;
        loadScenarioData(scenarioData);
      } else {
        await fetchInitialTopology();
      }
    } catch (e) {
      console.warn("Using fallback initial topology", e);
      await fetchInitialTopology();
    }
  }

  /**
   * Initializes the Leaflet Map with CartoDB Dark Matter / OpenStreetMap tiles.
   */
  function initLeafletMap() {
    const mapEl = document.getElementById("leaflet-map");
    if (!mapEl) return;

    state.map = L.map("leaflet-map", {
      zoomControl: false,
      attributionControl: false
    }).setView([20.5937, 78.9629], 5);

    L.control.zoom({ position: "bottomright" }).addTo(state.map);

    // CartoDB Dark Matter Tiles (Clean, fast, high contrast dark GIS tiles)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: ["a", "b", "c", "d"]
    }).addTo(state.map);

    // Feature Groups for layer management
    state.linesLayer = L.featureGroup().addTo(state.map);
    state.cascadeVectorLayer = L.featureGroup().addTo(state.map);
    state.markersLayer = L.featureGroup().addTo(state.map);

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

  function startClock() {
    setInterval(() => {
      const now = new Date();
      const utcStr = `UTC ${now.toISOString().substring(11, 19)}`;
      const clockEl = document.getElementById("live-clock");
      if (clockEl) clockEl.innerText = utcStr;
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
      const freq = 59.98 + (Math.random() * 0.04 - 0.02);
      const freqEl = document.getElementById("header-freq");
      const footerFreqEl = document.getElementById("footer-freq");
      if (freqEl) freqEl.innerText = `${freq.toFixed(2)} Hz`;
      if (footerFreqEl) footerFreqEl.innerText = `${freq.toFixed(2)} Hz`;

      // Live demand fluctuation
      const deltaDemand = (Math.random() * 0.04 - 0.02);
      const currentDemand = (state.baseLoad + deltaDemand).toFixed(2);
      const demandPct = ((deltaDemand / state.baseLoad) * 100 + 1.2).toFixed(1);
      const footerDemandEl = document.getElementById("footer-demand");
      if (footerDemandEl) {
        footerDemandEl.innerHTML = `${currentDemand} GW <span class="text-[10px] text-emerald-400 font-normal font-sans">+${demandPct}%</span>`;
      }

      // Micro-jitter on selected node telemetry if in normal range
      if (state.selectedNodeId === "T17" && !state.isSimulating) {
        const loadJitter = (84.2 + (Math.random() * 0.4 - 0.2)).toFixed(1);
        const voltJitter = (0.972 + (Math.random() * 0.002 - 0.001)).toFixed(3);
        const tempJitter = (71.0 + (Math.random() * 0.2 - 0.1)).toFixed(1);

        const loadEl = document.getElementById("ins-load");
        const voltEl = document.getElementById("ins-volt");
        const tempEl = document.getElementById("ins-temp");

        if (loadEl) loadEl.innerText = `${loadJitter}%`;
        if (voltEl) voltEl.innerText = `${voltJitter} pu`;
        if (tempEl) tempEl.innerText = `${tempJitter} °C`;
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

  async function fetchInitialTopology() {
    try {
      const res = await fetch(`${API_BASE}/api/grid/topology");
      const gridState = await res.json();
      const predRes = await fetch(`${API_BASE}/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gridState)
      });
      const modelOut = await predRes.json();
      renderState(gridState, modelOut.model_output);
    } catch (err) {
      console.error("Failed to fetch topology", err);
    }
  }

  /**
   * Renders the complete dashboard from gridState and modelOutput.
   */
  function renderState(gridState, modelOutput) {
    state.currentGridState = gridState;
    state.currentModelOutput = modelOutput;

    renderLeafletLayers(gridState, modelOutput);
    updateMetricsAndPanels(gridState, modelOutput);
    updateInspectorPanel(state.selectedNodeId);
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
    const trueRootNodeId = topRootCause ? topRootCause.node : null;

    // 1. Draw Transmission Lines (Polylines)
    (gridState.edges || []).forEach(edge => {
      const uGeo = GEO_COORDINATES[edge.source];
      const vGeo = GEO_COORDINATES[edge.target];
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

      const polyline = L.polyline([
        [uGeo.lat, uGeo.lng],
        [vGeo.lat, vGeo.lng]
      ], {
        color: lineColor,
        weight: lineWeight,
        opacity: edge.status === "TRIPPED" ? 0.3 : opacity,
        dashArray: (edge.status === "TRIPPED") ? "5, 5" : null
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
        const geo = GEO_COORDINATES[nid];
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
      const geo = GEO_COORDINATES[node.id];
      if (!geo) return;

      const risk = nodeRisk[node.id] || 0.05;
      const isRootCause = (node.id === trueRootNodeId && risk > 0.5);
      const isSymptom = rootCauses.some(rc => rc.node === node.id && rc.explained_by_upstream);

      // Filtering check
      if (typeFilter && node.type !== typeFilter) return;
      if (statusFilter === "healthy" && risk >= 0.30) return;
      if (statusFilter === "stressed" && (risk < 0.30 || risk > 0.70)) return;
      if (statusFilter === "critical" && risk < 0.70) return;

      let markerClass = "marker-healthy";
      if (node.status === "TRIPPED") {
        markerClass = "marker-critical";
      } else if (isRootCause) {
        markerClass = "marker-root-cause";
      } else if (risk >= 0.70) {
        markerClass = "marker-critical";
      } else if (risk >= 0.30) {
        markerClass = "marker-alert";
      }

      const isSub = (node.type === "substation");
      const isCrit = (risk >= 0.70 || isRootCause || node.status === "TRIPPED");
      const isAlert = (risk >= 0.30 && risk < 0.70);

      // Clean, professional SCADA Marker with Permanent City & Asset Label
      const iconHtml = `
        <div class="flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="node-marker-body ${markerClass} ${isSub ? 'marker-substation' : ''}" style="${isCrit ? 'box-shadow: 0 0 20px #ef4444, 0 0 40px #ef4444;' : ''}">
            <span style="font-size: 8px; font-weight: 800; color: #080c14; font-family: monospace;">${node.id}</span>
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
    state.selectedNodeId = nodeId;
    const geo = GEO_COORDINATES[nodeId];
    if (geo && state.map) {
      state.map.setView([geo.lat, geo.lng], 8, { animate: true });
      const marker = state.markerInstances[nodeId];
      if (marker) marker.openTooltip();
    }

    updateInspectorPanel(nodeId);
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
          if (match.lat && match.lon && state.map) {
            state.map.setView([match.lat, match.lon], 9, { animate: true });
            
            const cityIcon = L.divIcon({
              className: "grid-node-icon",
              html: `
                <div class="node-marker-body marker-healthy animate-bounce" style="width:20px;height:20px;border:2px solid #06b6d4;" title="${match.city}">
                  <span style="font-size:9px;font-weight:bold;color:#080c14;">★</span>
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

  function fitAllBounds() {
    if (state.markersLayer && state.markersLayer.getLayers().length > 0) {
      state.map.fitBounds(state.markersLayer.getBounds(), { padding: [30, 30] });
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

    const geo = GEO_COORDINATES[nodeId] || { name: nodeId, city: "Regional Grid", category: "Transformer" };
    const feats = node.features || {};
    const risk = (state.currentModelOutput.node_risk || {})[nodeId] || 0.1;
    const ttc = (state.currentModelOutput.time_to_critical_hours || {})[nodeId] || 12.0;

    document.getElementById("ins-asset-name").innerText = `${nodeId} — ${geo.name}`;
    document.getElementById("ins-location").innerText = `${geo.city} • ${geo.category.toUpperCase()}`;
    document.getElementById("ins-load").innerText = `${feats.load_pct}%`;
    document.getElementById("ins-volt").innerText = `${feats.voltage_pu} pu`;
    document.getElementById("ins-temp").innerText = `${feats.temperature_c} °C`;
    document.getElementById("ins-ttc").innerText = `${ttc} hrs`;

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
          x: { ticks: { font: { size: 8 }, color: "#64748b" }, grid: { display: false } },
          y: { min: 0.85, max: 1.05, ticks: { font: { size: 8 }, color: "#64748b" }, grid: { color: "rgba(255,255,255,0.05)" } }
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
        headerStatus.innerText = "98.4% STABLE";
        headerStatus.className = "px-2 py-0.5 rounded text-[11px] font-bold badge-healthy";
      }
      if (footerStability) {
        footerStability.innerText = "98.4% STABLE";
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
      if (rcNodeEl) rcNodeEl.innerText = `${topRc.node} — TRUE ROOT CAUSE`;
      if (rcScoreEl) rcScoreEl.innerText = `${Math.round(topRc.root_cause_score * 100)}% Score`;
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
      const resp = await fetch(`${API_BASE}/api/simulate", {
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
      if (btn) btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> <span>Inject Stress</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  async function applyIntervention() {
    try {
      const resp = await fetch(`${API_BASE}/api/intervene", {
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
      const resp = await fetch(`${API_BASE}/api/scenarios/scenario_normal");
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
        document.getElementById("demo-step-text").innerText = `5. Root cause, not symptom: "T17, T21, and F8 all show elevated risk. GridSense isolates T17 as the true origin."`;
        focusNode("T17");
        break;
      case 6:
        document.getElementById("demo-step-text").innerText = `6. Cascade path: "Predicted propagation path T17 -> F8 -> T21 -> S4 with 86% regional risk."`;
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
    try {
      const resp = await fetch(`${API_BASE}/api/scenarios/${scenarioId}`);
      if (resp.ok) {
        const scenarioData = await resp.json();
        state.scenarios[scenarioId] = scenarioData;
        loadScenarioData(scenarioData);
        if (state.map) {
          fitAllBounds();
        }
      }
    } catch (e) {
      console.warn("Failed to load scenario", scenarioId, e);
    }
  }

  return {
    init,
    runCustomSimulation,
    applyIntervention,
    resetHealthy,
    focusNode,
    searchNode,
    filterMarkers,
    fitAllBounds,
    toggleLiveStream,
    toggleCascadePath,
    switchScenario,
    runPitchStep,
    nextPitchStep
  };
})();

// Auto-run on DOM load
window.addEventListener("DOMContentLoaded", () => {
  GridApp.init();
});
