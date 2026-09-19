"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { GridNodes } from "./GridNodes";
import { GridEdges } from "./GridEdges";
import { EnergyFlow } from "./EnergyFlow";
import { CascadeAnimation } from "./CascadeAnimation";
import { IndiaMap3D } from "./IndiaMap3D";
import { CameraController } from "./CameraController";

export function GridScene() {
  return (
    <div className="absolute inset-0">
      <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 22, 18]} fov={45} />
          <CameraController />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={8}
            maxDistance={40}
          />
          <ambientLight intensity={0.25} />
          <directionalLight position={[10, 20, 10]} intensity={0.6} />
          <pointLight position={[0, 15, 0]} intensity={0.4} color="#00E5FF" />
          <color attach="background" args={["#101010"]} />
          <fog attach="fog" args={["#101010", 30, 60]} />

          <Stars radius={80} depth={40} count={800} factor={2} saturation={0} fade speed={0.3} />

          {/* India map underneath */}
          <IndiaMap3D />

          {/* Grid assets on top */}
          <GridNodes />
          <GridEdges />
          <EnergyFlow />
          <CascadeAnimation />
        </Suspense>
      </Canvas>
    </div>
  );
}
