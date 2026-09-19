"use client";
import { useMemo } from "react";
import { INDIA_OUTLINE, latLonToScene, INDIA_REGIONS } from "@/lib/indiaGeo";
import * as THREE from "three";

// Cast Three.js line element to any to prevent JSX SVG conflict
const ThreeLine = "line" as any;

// Approximate centroids for the Maharashtra sub-regions in INDIA_REGIONS.
// These must stay keyed to INDIA_REGIONS[].id — they previously still used the
// old national zone ids (NR/WR/SR/ER/NER), so every lookup returned undefined.
const REGION_CENTROIDS: Record<string, [number, number]> = {
  MMR: [73.10, 19.10], // Konkan / Mumbai Metropolitan Region
  WMR: [74.30, 17.70], // Western Maharashtra — Pune, Satara, Kolhapur
  NMR: [74.80, 20.60], // North Maharashtra — Nashik, Jalgaon, Dhule
  MTR: [76.80, 19.20], // Marathwada — Chh. Sambhajinagar, Latur, Nanded
  VDR: [78.90, 20.80], // Vidarbha — Nagpur, Amravati, Chandrapur
};

export function IndiaMap3D() {
  const outlinePoints = useMemo(() => {
    return INDIA_OUTLINE.map(([lon, lat]) => {
      const [x, , z] = latLonToScene(lat, lon);
      return new THREE.Vector3(x, 0.01, z);
    });
  }, []);

  const outlineGeometry = useMemo(() => {
    const closed = [...outlinePoints, outlinePoints[0]];
    return new THREE.BufferGeometry().setFromPoints(closed);
  }, [outlinePoints]);

  // Create filled India shape
  const fillShape = useMemo(() => {
    const shape = new THREE.Shape();
    outlinePoints.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    return shape;
  }, [outlinePoints]);

  return (
    <group>
      {/* Filled landmass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial color="#1E1E1E" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Glowing outline */}
      <ThreeLine geometry={outlineGeometry}>
        <lineBasicMaterial color="#00E5FF" transparent opacity={0.7} />
      </ThreeLine>

      {/* Second outline for glow */}
      <ThreeLine geometry={outlineGeometry} position={[0, 0.02, 0]}>
        <lineBasicMaterial color="#00E5FF" transparent opacity={0.3} />
      </ThreeLine>

      {/* Region labels */}
      {INDIA_REGIONS.map((region) => {
        const [lon, lat] = REGION_CENTROIDS[region.id] ?? [];
        // A region with no centroid is skipped rather than rendered at a wrong
        // place on the map. Guarding here also means adding a region to
        // INDIA_REGIONS can never take down the whole dashboard route.
        if (lon === undefined || lat === undefined) return null;
        const [x, , z] = latLonToScene(lat, lon);
        return (
          <mesh key={region.id} position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial color={region.color} transparent opacity={0.08} />
          </mesh>
        );
      })}
    </group>
  );
}
