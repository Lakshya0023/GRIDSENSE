"use client";
import { useMemo } from "react";
import { useGridStore } from "@/store/gridStore";
import * as THREE from "three";

// Cast Three.js line to any to avoid JSX conflict with SVG line element
const ThreeLine = "line" as any;

export function GridEdges() {
  const gridState = useGridStore((s) => s.gridState);

  const nodeMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    if (!gridState) return map;
    gridState.nodes.forEach((n) =>
      map.set(n.id, new THREE.Vector3(n.position.x, n.position.y + 0.3, n.position.z))
    );
    return map;
  }, [gridState]);

  if (!gridState) return null;

  return (
    <group>
      {gridState.edges.map((edge) => {
        const start = nodeMap.get(edge.source);
        const end = nodeMap.get(edge.target);
        if (!start || !end) return null;

        const points = [start, end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const color = edge.is_cascade_path
          ? "#FF3B5C"
          : edge.status === "stressed"
          ? "#FFD166"
          : "#00E5FF";
        const opacity = edge.is_cascade_path ? 0.9 : 0.25;

        return (
          <ThreeLine key={edge.id} geometry={geometry}>
            <lineBasicMaterial color={color} transparent opacity={opacity} />
          </ThreeLine>
        );
      })}
    </group>
  );
}
