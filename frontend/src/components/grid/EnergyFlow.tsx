"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGridStore } from "@/store/gridStore";
import * as THREE from "three";

export function EnergyFlow() {
  const gridState = useGridStore((s) => s.gridState);
  if (!gridState) return null;

  return (
    <group>
      {gridState.edges.filter((e) => e.is_cascade_path || e.current_load_pct > 50).map((edge) => {
        const startNode = gridState.nodes.find((n) => n.id === edge.source);
        const endNode = gridState.nodes.find((n) => n.id === edge.target);
        if (!startNode || !endNode) return null;
        return (
          <FlowDot
            key={edge.id}
            start={[startNode.position.x, startNode.position.y + 0.3, startNode.position.z]}
            end={[endNode.position.x, endNode.position.y + 0.3, endNode.position.z]}
            isCascade={edge.is_cascade_path}
          />
        );
      })}
    </group>
  );
}

function FlowDot({ start, end, isCascade }: { start: [number, number, number]; end: [number, number, number]; isCascade: boolean }) {
  const dotRef = useRef<THREE.Mesh>(null);
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame((state) => {
    if (!dotRef.current) return;
    const progress = (state.clock.elapsedTime * (isCascade ? 1.5 : 0.8)) % 1;
    dotRef.current.position.lerpVectors(startVec, endVec, progress);
  });

  return (
    <mesh ref={dotRef}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color={isCascade ? "#FF3B5C" : "#00E5FF"} />
    </mesh>
  );
}
