"use client";
import { Grid } from "@react-three/drei";

export function GridGround() {
  return (
    <>
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#262626"
        sectionSize={5}
        sectionThickness={0.6}
        sectionColor="#3A3A3A"
        fadeDistance={35}
        fadeStrength={1}
        infiniteGrid
        position={[0, -0.01, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial color="#141414" transparent opacity={0.8} />
      </mesh>
    </>
  );
}
