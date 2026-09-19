import { latLonToScene } from "./indiaGeo";
import type { GridState } from "./types";

const CUSTOM_GRID_KEY = "gridsense-custom-grid";

function withMapPositions(grid: GridState): GridState {
  return {
    ...grid,
    nodes: grid.nodes.map((node) => {
      if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) return node;
      const [x, y, z] = latLonToScene(node.lat, node.lon);
      return { ...node, position: { x, y, z } };
    }),
  };
}

export function saveCustomGrid(grid: GridState): GridState {
  const mappedGrid = withMapPositions(grid);
  window.sessionStorage.setItem(CUSTOM_GRID_KEY, JSON.stringify(mappedGrid));
  return mappedGrid;
}

export function getCustomGrid(): GridState | null {
  try {
    const rawGrid = window.sessionStorage.getItem(CUSTOM_GRID_KEY);
    if (!rawGrid) return null;
    const grid = JSON.parse(rawGrid) as GridState;
    return Array.isArray(grid.nodes) && Array.isArray(grid.edges) ? withMapPositions(grid) : null;
  } catch {
    window.sessionStorage.removeItem(CUSTOM_GRID_KEY);
    return null;
  }
}
