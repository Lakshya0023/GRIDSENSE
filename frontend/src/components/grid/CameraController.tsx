"use client";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGridStore } from "@/store/gridStore";
import * as THREE from "three";

export function CameraController() {
  const selectedNodeId = useGridStore((s) => s.selectedNodeId);
  const gridState = useGridStore((s) => s.gridState);
  const demoPhase = useGridStore((s) => s.demoPhase);
  const { camera } = useThree();

  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const targetCam = useRef(new THREE.Vector3(0, 22, 18));

  useEffect(() => {
    if (demoPhase === "root_cause_found" || demoPhase === "cascade_visualized") {
      const rootNode = gridState?.nodes.find((n) => n.is_root_cause);
      if (rootNode) {
        targetPos.current.set(rootNode.position.x, 0, rootNode.position.z);
        targetCam.current.set(
          rootNode.position.x + 4,
          8,
          rootNode.position.z + 4
        );
      }
    } else if (selectedNodeId && gridState) {
      const node = gridState.nodes.find((n) => n.id === selectedNodeId);
      if (node) {
        targetPos.current.set(node.position.x, 0, node.position.z);
        targetCam.current.set(node.position.x + 3, 6, node.position.z + 3);
      }
    } else {
      targetPos.current.set(0, 0, 0);
      targetCam.current.set(0, 22, 18);
    }
  }, [selectedNodeId, gridState, demoPhase]);

  useFrame(() => {
    camera.position.lerp(targetCam.current, 0.03);
    camera.lookAt(targetPos.current);
  });

  return null;
}
