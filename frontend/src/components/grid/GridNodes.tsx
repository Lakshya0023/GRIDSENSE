"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useGridStore } from "@/store/gridStore";
import type { GridNode, NodeType } from "@/lib/types";
import * as THREE from "three";

export function GridNodes() {
  const gridState = useGridStore((s) => s.gridState);
  if (!gridState) return null;
  return (
    <group>
      {gridState.nodes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}
    </group>
  );
}

function NodeMesh({ node }: { node: GridNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const selectedNodeId = useGridStore((s) => s.selectedNodeId);
  const selectNode = useGridStore((s) => s.selectNode);
  const hoverNode = useGridStore((s) => s.hoverNode);
  const hoveredNodeId = useGridStore((s) => s.hoveredNodeId);

  const isSelected = selectedNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const isRoot = node.is_root_cause;
  const isCritical = node.status === "critical" || node.status === "root_cause";
  const isWarning = node.status === "warning" || node.status === "high_risk" || node.status === "affected";

  const color = isRoot ? "#FF3B5C" : isCritical ? "#FF3B5C" : isWarning ? "#FFD166" : "#39FF88";
  const emissive = isRoot ? 2.0 : isCritical ? 1.2 : isWarning ? 0.7 : 0.35;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current && (isRoot || isCritical || isSelected)) {
      ringRef.current.rotation.z = t * 1.2;
    }
    if (ring2Ref.current && isRoot) {
      ring2Ref.current.rotation.z = -t * 0.8;
    }
    if (glowRef.current && (isRoot || isCritical)) {
      const s = 1 + Math.sin(t * 4) * 0.15;
      glowRef.current.scale.setScalar(s);
    }
    if (groupRef.current && isRoot) {
      groupRef.current.position.y = node.position.y + 0.3 + Math.sin(t * 3) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[node.position.x, node.position.y + 0.3, node.position.z]}>
      {/* Base pedestal for larger assets */}
      {(node.type === "substation" || node.type === "generator") && (
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.25, 0.3, 0.05, 8]} />
          <meshStandardMaterial color="#2C2C2C" emissive={color} emissiveIntensity={0.05} />
        </mesh>
      )}

      {/* Main geometry by type */}
      <group
        onClick={(e) => { e.stopPropagation(); selectNode(isSelected ? null : node.id); }}
        onPointerEnter={(e) => { e.stopPropagation(); hoverNode(node.id); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { hoverNode(null); document.body.style.cursor = "default"; }}
      >
        <NodeGeometry type={node.type} color={color} emissive={emissive} />
      </group>

      {/* Glow sphere for critical/root cause */}
      {(isRoot || isCritical) && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={isRoot ? 0.25 : 0.15} depthWrite={false} />
        </mesh>
      )}

      {/* Rotating ring for root cause and critical */}
      {(isRoot || isCritical || isSelected) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.45, 0.02, 8, 32]} />
          <meshBasicMaterial color={isRoot ? "#FF3B5C" : isSelected ? "#00E5FF" : "#FFD166"} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Second ring for root cause */}
      {isRoot && (
        <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, Math.PI / 4]}>
          <torusGeometry args={[0.65, 0.015, 8, 32]} />
          <meshBasicMaterial color="#FF3B5C" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Vertical AI marker beam for root cause */}
      {isRoot && (
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 2, 6]} />
          <meshBasicMaterial color="#FF3B5C" transparent opacity={0.4} />
        </mesh>
      )}

      {/* Label */}
      <Html position={[0, 0.6, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <NodeLabel node={node} isSelected={isSelected} isHovered={isHovered} />
      </Html>
    </group>
  );
}

function NodeGeometry({ type, color, emissive }: { type: NodeType; color: string; emissive: number }) {
  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={emissive}
      metalness={0.6}
      roughness={0.3}
    />
  );

  switch (type) {
    case "generator":
      // Power plant — layered cylinder like a cooling tower
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.24, 0.35, 8]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.14, 0.18, 0.1, 8]} />
            {mat}
          </mesh>
        </group>
      );
    case "substation":
      // Substation — box with vertical elements
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.35, 0.15, 0.35]} />
            {mat}
          </mesh>
          <mesh position={[-0.12, 0.15, -0.12]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
            {mat}
          </mesh>
          <mesh position={[0.12, 0.15, -0.12]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
            {mat}
          </mesh>
          <mesh position={[-0.12, 0.15, 0.12]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
            {mat}
          </mesh>
          <mesh position={[0.12, 0.15, 0.12]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
            {mat}
          </mesh>
        </group>
      );
    case "transformer":
      // Transformer — stacked rings
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.08, 8]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.06, 8]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.14, 0.16, 0.05, 8]} />
            {mat}
          </mesh>
        </group>
      );
    case "load_center":
      // Load center — dodecahedron (city-like)
      return (
        <mesh>
          <dodecahedronGeometry args={[0.22, 0]} />
          {mat}
        </mesh>
      );
    case "feeder":
      return (
        <mesh>
          <sphereGeometry args={[0.14, 12, 12]} />
          {mat}
        </mesh>
      );
    case "switch":
      return (
        <mesh>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          {mat}
        </mesh>
      );
    default:
      return (
        <mesh>
          <sphereGeometry args={[0.15, 12, 12]} />
          {mat}
        </mesh>
      );
  }
}

function NodeLabel({ node, isSelected, isHovered }: { node: GridNode; isSelected: boolean; isHovered: boolean }) {
  const show = isSelected || isHovered || node.is_root_cause || node.status === "critical" || node.type === "substation" || node.type === "generator";
  if (!show) return null;

  const isRoot = node.is_root_cause;
  return (
    <div className="flex flex-col items-center gap-0.5 select-none" style={{ minWidth: "40px" }}>
      <div className={`px-1.5 py-0.5 rounded text-2xs font-mono font-bold whitespace-nowrap ${
        isRoot ? "bg-red-950/90 text-grid-red border border-grid-red" :
        node.status === "critical" ? "bg-red-950/80 text-grid-red border border-grid-red/50" :
        "bg-grid-bg-panel/90 text-grid-text-primary border border-grid-border"
      }`}>
        {node.id}
        {isRoot && <span className="ml-1 text-[8px]">ROOT</span>}
      </div>
      {(isSelected || isRoot) && (
        <div className="text-[9px] font-mono bg-grid-bg-panel/80 px-1.5 py-0.5 rounded border border-grid-border text-grid-text-secondary whitespace-nowrap">
          {node.label}
        </div>
      )}
    </div>
  );
}
