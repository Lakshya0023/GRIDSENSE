import { create } from "zustand";
import type { GridState, GridNode, PredictionResult, InterventionResult, DemoPhase, ProcessingStep, SimulationConfig, CameraState } from "@/lib/types";

interface GridStore {
  gridState: GridState | null;
  setGridState: (state: GridState) => void;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  prediction: PredictionResult | null;
  setPrediction: (prediction: PredictionResult | null) => void;
  interventionResult: InterventionResult | null;
  setInterventionResult: (result: InterventionResult | null) => void;
  demoPhase: DemoPhase;
  setDemoPhase: (phase: DemoPhase) => void;
  advanceDemoPhase: () => void;
  isProcessing: boolean;
  currentProcessingStep: ProcessingStep | null;
  setProcessing: (processing: boolean, step?: ProcessingStep | null) => void;
  simulationConfig: SimulationConfig;
  updateSimulationConfig: (config: Partial<SimulationConfig>) => void;
  resetSimulation: () => void;
  camera: CameraState;
  setCameraTarget: (target: [number, number, number] | null) => void;
  activeCascadeStep: number;
  setActiveCascadeStep: (step: number) => void;
  isCascadeAnimating: boolean;
  setCascadeAnimating: (animating: boolean) => void;
  showNodeDetail: boolean;
  setShowNodeDetail: (show: boolean) => void;
  isDemoMode: boolean;
  setDemoMode: (demo: boolean) => void;
}

const DEMO_PHASE_ORDER: DemoPhase[] = ["healthy", "stress_applied", "predicting", "root_cause_found", "cascade_visualized", "intervention_applied", "mitigated"];

export const useGridStore = create<GridStore>((set, get) => ({
  gridState: null,
  setGridState: (state) => set({ gridState: state }),
  selectedNodeId: null,
  hoveredNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id, showNodeDetail: id !== null }),
  hoverNode: (id) => set({ hoveredNodeId: id }),
  prediction: null,
  setPrediction: (prediction) => set({ prediction }),
  interventionResult: null,
  setInterventionResult: (result) => set({ interventionResult: result }),
  demoPhase: "healthy",
  setDemoPhase: (phase) => set({ demoPhase: phase }),
  advanceDemoPhase: () => {
    const current = get().demoPhase;
    const idx = DEMO_PHASE_ORDER.indexOf(current);
    if (idx < DEMO_PHASE_ORDER.length - 1) {
      set({ demoPhase: DEMO_PHASE_ORDER[idx + 1] });
    }
  },
  isProcessing: false,
  currentProcessingStep: null,
  setProcessing: (processing, step = null) => set({ isProcessing: processing, currentProcessingStep: step }),
  simulationConfig: { demand_stress_pct: 0, temperature_delta_c: 0, load_multiplier: 1.0, disabled_nodes: [] },
  updateSimulationConfig: (config) => set((s) => ({ simulationConfig: { ...s.simulationConfig, ...config } })),
  resetSimulation: () => set({ prediction: null, interventionResult: null, demoPhase: "healthy", activeCascadeStep: -1 }),
  camera: { target: null, zoom: 1, autoRotate: true, followCascade: false },
  setCameraTarget: (target) => set((s) => ({ camera: { ...s.camera, target } })),
  activeCascadeStep: -1,
  setActiveCascadeStep: (step) => set({ activeCascadeStep: step }),
  isCascadeAnimating: false,
  setCascadeAnimating: (animating) => set({ isCascadeAnimating: animating }),
  showNodeDetail: false,
  setShowNodeDetail: (show) => set({ showNodeDetail: show }),
  isDemoMode: true,
  setDemoMode: (demo) => set({ isDemoMode: demo }),
}));
