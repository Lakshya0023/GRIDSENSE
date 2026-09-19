// Maharashtra Geographic Bounds for 3D digital projection
export const INDIA_BOUNDS = {
  minLon: 72.5,
  maxLon: 81.0,
  minLat: 15.6,
  maxLat: 22.2,
};

// Convert Maharashtra lat/lon to 3D scene coordinates in [-10, 10] box
export function latLonToScene(lat: number, lon: number): [number, number, number] {
  const { minLon, maxLon, minLat, maxLat } = INDIA_BOUNDS;
  const width = 20;
  const depth = 20;
  const x = ((lon - minLon) / (maxLon - minLon)) * width - width / 2;
  const z = -(((lat - minLat) / (maxLat - minLat)) * depth - depth / 2);
  return [x, 0, z];
}

// Regional grid zones across Maharashtra
export const INDIA_REGIONS = [
  { id: "MMR", name: "Konkan / MMR", color: "#00E5FF", states: ["Maharashtra"] },
  { id: "WMR", name: "Western Maharashtra", color: "#39FF88", states: ["Maharashtra"] },
  { id: "NMR", name: "North Maharashtra", color: "#FFD166", states: ["Maharashtra"] },
  { id: "MTR", name: "Marathwada Region", color: "#B56CFF", states: ["Maharashtra"] },
  { id: "VDR", name: "Vidarbha Region", color: "#FF6B9D", states: ["Maharashtra"] },
];

// Geographical boundary coordinates outline of Maharashtra State
export const INDIA_OUTLINE: [number, number][] = [
  [72.70, 20.10], // Palghar / Dahanu Coast
  [72.82, 19.10], // Mumbai Coast
  [73.05, 18.20], // Raigad Coast
  [73.28, 17.00], // Ratnagiri Coast
  [73.55, 15.80], // Sindhudurg / Goa Border
  [74.20, 15.75], // Kolhapur South Border
  [74.55, 16.80], // Sangli / Karnataka Border
  [75.90, 17.65], // Solapur Border
  [76.60, 18.25], // Latur Border
  [77.30, 18.80], // Nanded Border
  [78.10, 19.30], // Yavatmal South
  [79.25, 19.15], // Chandrapur South Border
  [80.30, 18.90], // Gadchiroli South Tip
  [80.55, 19.80], // Gadchiroli East
  [80.20, 21.10], // Gondia East Border
  [79.80, 21.50], // Bhandara / MP Border
  [79.10, 21.65], // Nagpur North / MP Border
  [77.75, 21.45], // Amravati North (Melghat)
  [75.80, 21.35], // Jalgaon North
  [74.80, 21.95], // Nandurbar North Tip
  [74.00, 21.40], // Nandurbar / Gujarat Border
  [73.30, 20.60], // Nashik / Gujarat Border
  [72.70, 20.10], // Back to Palghar Coast
];

// Grid asset definitions with real Maharashtra geographic positions
export interface IndiaGridAsset {
  id: string;
  type: "generator" | "substation" | "transformer" | "feeder" | "switch" | "load_center";
  label: string;
  state: string;
  region: string;
  lat: number;
  lon: number;
  baseLoad: number;
  baseVoltage: number;
  baseTemp: number;
  age: number;
  capacity: number;
}

export const INDIA_GRID_ASSETS: IndiaGridAsset[] = [
  // ── Generating Stations in Maharashtra ──
  { id: "G1", type: "generator", label: "Koyna Hydro Complex G1", state: "Maharashtra", region: "WMR", lat: 17.40, lon: 73.75, baseLoad: 58, baseVoltage: 1.02, baseTemp: 44, age: 35, capacity: 1960 },
  { id: "G2", type: "generator", label: "Chandrapur Super Thermal G2", state: "Maharashtra", region: "VDR", lat: 19.95, lon: 79.30, baseLoad: 72, baseVoltage: 1.01, baseTemp: 63, age: 22, capacity: 3340 },
  { id: "G3", type: "generator", label: "Tarapur Atomic Station G3", state: "Maharashtra", region: "MMR", lat: 19.83, lon: 72.66, baseLoad: 65, baseVoltage: 1.02, baseTemp: 48, age: 25, capacity: 1400 },
  { id: "G4", type: "generator", label: "Koradi Super Thermal G4", state: "Maharashtra", region: "VDR", lat: 21.25, lon: 79.10, baseLoad: 68, baseVoltage: 1.02, baseTemp: 59, age: 18, capacity: 2400 },
  { id: "G5", type: "generator", label: "Trombay Thermal G5", state: "Maharashtra", region: "MMR", lat: 19.01, lon: 72.90, baseLoad: 60, baseVoltage: 1.02, baseTemp: 46, age: 20, capacity: 1580 },
  { id: "G6", type: "generator", label: "Khaperkheda Thermal G6", state: "Maharashtra", region: "VDR", lat: 21.28, lon: 79.12, baseLoad: 66, baseVoltage: 1.01, baseTemp: 61, age: 19, capacity: 1340 },
  { id: "G7", type: "generator", label: "Bhusawal Deepnagar Thermal G7", state: "Maharashtra", region: "NMR", lat: 21.05, lon: 75.80, baseLoad: 62, baseVoltage: 1.00, baseTemp: 58, age: 16, capacity: 1420 },
  { id: "G8", type: "generator", label: "Parli Super Thermal G8", state: "Maharashtra", region: "MTR", lat: 18.85, lon: 76.50, baseLoad: 55, baseVoltage: 1.01, baseTemp: 52, age: 21, capacity: 1130 },

  // ── Major Maharashtra Substations ──
  { id: "S1", type: "substation", label: "Thane-Kalwa 400kV Sub S1", state: "Maharashtra", region: "MMR", lat: 19.20, lon: 72.99, baseLoad: 74, baseVoltage: 1.00, baseTemp: 58, age: 18, capacity: 600 },
  { id: "S2", type: "substation", label: "Chhatrapati Sambhajinagar Sub S2", state: "Maharashtra", region: "MTR", lat: 19.88, lon: 75.34, baseLoad: 64, baseVoltage: 1.00, baseTemp: 54, age: 14, capacity: 500 },
  { id: "S3", type: "substation", label: "Mumbai Central 400kV Sub S3", state: "Maharashtra", region: "MMR", lat: 19.07, lon: 72.87, baseLoad: 78, baseVoltage: 0.99, baseTemp: 62, age: 22, capacity: 750 },
  { id: "S4", type: "substation", label: "Pune 400kV Grid Sub S4", state: "Maharashtra", region: "WMR", lat: 18.52, lon: 73.85, baseLoad: 65, baseVoltage: 1.00, baseTemp: 56, age: 15, capacity: 650 },
  { id: "S5", type: "substation", label: "Solapur 400kV Grid Sub S5", state: "Maharashtra", region: "WMR", lat: 17.66, lon: 75.91, baseLoad: 62, baseVoltage: 1.00, baseTemp: 55, age: 12, capacity: 500 },
  { id: "S6", type: "substation", label: "Kolhapur 400kV Regional Sub S6", state: "Maharashtra", region: "WMR", lat: 16.70, lon: 74.24, baseLoad: 58, baseVoltage: 1.00, baseTemp: 53, age: 16, capacity: 450 },
  { id: "S7", type: "substation", label: "Wardha 765kV Super Grid Sub S7", state: "Maharashtra", region: "VDR", lat: 20.74, lon: 78.60, baseLoad: 70, baseVoltage: 1.01, baseTemp: 60, age: 11, capacity: 800 },
  { id: "S8", type: "substation", label: "Amravati 400kV Grid Sub S8", state: "Maharashtra", region: "VDR", lat: 20.93, lon: 77.75, baseLoad: 60, baseVoltage: 1.00, baseTemp: 54, age: 13, capacity: 500 },
  { id: "S9", type: "substation", label: "Nanded EHV Grid Sub S9", state: "Maharashtra", region: "MTR", lat: 19.15, lon: 77.30, baseLoad: 56, baseVoltage: 1.00, baseTemp: 51, age: 10, capacity: 400 },
  { id: "S10", type: "substation", label: "Nashik EHV Super Sub S10", state: "Maharashtra", region: "NMR", lat: 19.98, lon: 73.81, baseLoad: 68, baseVoltage: 0.99, baseTemp: 57, age: 12, capacity: 450 },

  // ── Critical Stress & Cascade Corridor (Nashik - Pune) ──
  { id: "T17", type: "transformer", label: "Nashik Heavy Step-Down T17", state: "Maharashtra", region: "NMR", lat: 19.99, lon: 73.78, baseLoad: 78, baseVoltage: 0.97, baseTemp: 65, age: 12, capacity: 250 },
  { id: "F8", type: "feeder", label: "Feeder F8 Nashik-Pune Corridor", state: "Maharashtra", region: "NMR", lat: 19.25, lon: 73.83, baseLoad: 55, baseVoltage: 0.98, baseTemp: 48, age: 11, capacity: 200 },

  // ── Key Maharashtra Step-Down Transformers ──
  { id: "T1", type: "transformer", label: "Navi Mumbai Step-Down T1", state: "Maharashtra", region: "MMR", lat: 19.03, lon: 73.02, baseLoad: 68, baseVoltage: 0.99, baseTemp: 59, age: 14, capacity: 315 },
  { id: "T3", type: "transformer", label: "Kalyan Industrial Trans T3", state: "Maharashtra", region: "MMR", lat: 19.24, lon: 73.13, baseLoad: 62, baseVoltage: 0.98, baseTemp: 57, age: 11, capacity: 280 },
  { id: "T5", type: "transformer", label: "Ahmednagar Regional Trans T5", state: "Maharashtra", region: "NMR", lat: 19.09, lon: 74.74, baseLoad: 58, baseVoltage: 1.00, baseTemp: 53, age: 9, capacity: 250 },
  { id: "T6", type: "transformer", label: "Ratnagiri Coastal Trans T6", state: "Maharashtra", region: "MMR", lat: 16.99, lon: 73.30, baseLoad: 52, baseVoltage: 1.00, baseTemp: 49, age: 8, capacity: 200 },
  { id: "T7", type: "transformer", label: "Sangli Industrial Step-Down T7", state: "Maharashtra", region: "WMR", lat: 16.85, lon: 74.57, baseLoad: 58, baseVoltage: 0.99, baseTemp: 54, age: 13, capacity: 180 },
  { id: "T8", type: "transformer", label: "Akola Central Trans T8", state: "Maharashtra", region: "VDR", lat: 20.70, lon: 77.00, baseLoad: 54, baseVoltage: 1.00, baseTemp: 52, age: 7, capacity: 200 },
  { id: "T9", type: "transformer", label: "Latur Regional Trans T9", state: "Maharashtra", region: "MTR", lat: 18.40, lon: 76.58, baseLoad: 56, baseVoltage: 0.99, baseTemp: 53, age: 15, capacity: 220 },
  { id: "T14", type: "transformer", label: "Nagpur Interconnect T14", state: "Maharashtra", region: "VDR", lat: 21.15, lon: 79.08, baseLoad: 48, baseVoltage: 1.01, baseTemp: 49, age: 6, capacity: 250 },
  { id: "T19", type: "transformer", label: "Aurangabad Trans T19", state: "Maharashtra", region: "MTR", lat: 19.87, lon: 75.34, baseLoad: 52, baseVoltage: 1.00, baseTemp: 51, age: 7, capacity: 220 },

  // ── High-Density Load Centers in Maharashtra ──
  { id: "L1", type: "load_center", label: "Pune Hinjewadi IT Load L1", state: "Maharashtra", region: "WMR", lat: 18.59, lon: 73.74, baseLoad: 82, baseVoltage: 0.98, baseTemp: 42, age: 10, capacity: 450 },
  { id: "L2", type: "load_center", label: "Mumbai Financial Load L2", state: "Maharashtra", region: "MMR", lat: 19.08, lon: 72.88, baseLoad: 86, baseVoltage: 0.97, baseTemp: 45, age: 15, capacity: 550 },
  { id: "L3", type: "load_center", label: "Nagpur MIHAN Industrial Load L3", state: "Maharashtra", region: "VDR", lat: 21.05, lon: 79.05, baseLoad: 75, baseVoltage: 0.99, baseTemp: 41, age: 8, capacity: 400 },
];

export const INDIA_GRID_EDGES = [
  // ── Mumbai & Konkan Power Distribution ──
  { source: "G3", target: "S1", type: "transmission", capacity: 900.0 },
  { source: "G5", target: "S3", type: "transmission", capacity: 950.0 },
  { source: "S1", target: "S3", type: "transmission", capacity: 850.0 },
  { source: "S1", target: "T1", type: "distribution", capacity: 400.0 },
  { source: "S1", target: "T3", type: "distribution", capacity: 400.0 },
  { source: "S3", target: "L2", type: "distribution", capacity: 550.0 },
  { source: "S3", target: "T6", type: "transmission", capacity: 300.0 },

  // ── Western Maharashtra Cascade Path (T17 -> F8 -> S4) ──
  { source: "S3", target: "T17", type: "distribution", capacity: 350.0 },
  { source: "S10", target: "T17", type: "distribution", capacity: 350.0 },
  { source: "T17", target: "F8", type: "feeder", capacity: 200.0 },
  { source: "F8", target: "S4", type: "feeder", capacity: 200.0 },
  { source: "S4", target: "L1", type: "distribution", capacity: 450.0 },
  { source: "G1", target: "S4", type: "transmission", capacity: 950.0 },
  { source: "G1", target: "S6", type: "transmission", capacity: 850.0 },
  { source: "S6", target: "T7", type: "distribution", capacity: 250.0 },
  { source: "S4", target: "S5", type: "transmission", capacity: 500.0 },
  { source: "S5", target: "T9", type: "distribution", capacity: 300.0 },

  // ── North Maharashtra & Khandesh Links ──
  { source: "T17", target: "T5", type: "tie", capacity: 250.0 },
  { source: "T5", target: "S2", type: "distribution", capacity: 300.0 },
  { source: "G7", target: "S10", type: "transmission", capacity: 850.0 },
  { source: "G7", target: "T8", type: "distribution", capacity: 350.0 },

  // ── Marathwada Corridors ──
  { source: "T17", target: "T19", type: "tie", capacity: 200.0 },
  { source: "S2", target: "T19", type: "distribution", capacity: 280.0 },
  { source: "S2", target: "G8", type: "transmission", capacity: 600.0 },
  { source: "G8", target: "S9", type: "transmission", capacity: 650.0 },
  { source: "S9", target: "T9", type: "distribution", capacity: 250.0 },

  // ── Vidarbha Power Generation & Distribution ──
  { source: "G2", target: "S7", type: "transmission", capacity: 1200.0 },
  { source: "G4", target: "T14", type: "transmission", capacity: 900.0 },
  { source: "G6", target: "T14", type: "transmission", capacity: 800.0 },
  { source: "T14", target: "L3", type: "distribution", capacity: 400.0 },
  { source: "S7", target: "T14", type: "transmission", capacity: 700.0 },
  { source: "S7", target: "S8", type: "transmission", capacity: 600.0 },
  { source: "S8", target: "T8", type: "distribution", capacity: 300.0 },
  { source: "T17", target: "T14", type: "tie", capacity: 250.0 },

  // ── Maharashtra State High-Voltage 400kV/765kV Backbone Ring ──
  { source: "S3", target: "S4", type: "transmission", capacity: 900.0 },
  { source: "S4", target: "S2", type: "transmission", capacity: 700.0 },
  { source: "S2", target: "S9", type: "transmission", capacity: 600.0 },
  { source: "S9", target: "S7", type: "transmission", capacity: 650.0 },
  { source: "S7", target: "S8", type: "transmission", capacity: 700.0 },
  { source: "S8", target: "S2", type: "transmission", capacity: 600.0 },
  { source: "S5", target: "S6", type: "transmission", capacity: 550.0 },
  { source: "S1", target: "S10", type: "transmission", capacity: 700.0 },
];
