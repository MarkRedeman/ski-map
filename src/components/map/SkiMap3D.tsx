import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import { Suspense } from "react";
import { ContourTerrain } from "./ContourTerrain";
import { SatelliteGround } from "./SatelliteGround";
import { Pistes } from "./Pistes";
import { Lifts } from "./Lifts";
import { UserMarker } from "./UserMarker";
import { RouteOverlay } from "./RouteOverlay";
import { RunPath } from "./RunPath";
import { InfoTooltip } from "./InfoTooltip";
import { InfoPanel } from "./InfoPanel";
import { ProximitySelector } from "./ProximitySelector";
import { KeyboardControls } from "./KeyboardControls";
import { useSelectedRun } from "@/hooks/useRuns";

export function SkiMap3D() {
  const selectedRun = useSelectedRun();

  // Camera and controls are centered on Giggijoch (0, 0, 0)
  // since all geo coordinates are converted relative to SOLDEN_CENTER

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{
          // Position camera looking at Giggijoch from the south
          position: [0, 300, 400],
          fov: 50,
          near: 1,
          far: 10000,
        }}
        shadows
        gl={{ antialias: true }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[100, 200, 50]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={1000}
          shadow-camera-left={-500}
          shadow-camera-right={500}
          shadow-camera-top={500}
          shadow-camera-bottom={-500}
        />

        {/* Sky / Environment */}
        <Environment preset="dawn" />
        <fog attach="fog" args={["#87ceeb", 500, 2500]} />

        {/* Origin marker (for debugging) */}
        <mesh position={[0, 10, 0]}>
          <sphereGeometry args={[5, 16, 16]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>

        {/* 3D Content */}
        <Suspense fallback={null}>
          {/* Satellite imagery as ground layer */}
          <SatelliteGround yPosition={0} zoom={12} />
          {/* Contour lines on top */}
          <ContourTerrain />
          <Pistes />
          <Lifts />
          <UserMarker />
          <RouteOverlay />
          {/* Render selected ski run if available */}
          {selectedRun && <RunPath run={selectedRun} />}
          {/* Hover tooltip */}
          <InfoTooltip />
          {/* Proximity-based selection handler */}
          <ProximitySelector />
        </Suspense>

        {/* Keyboard Controls */}
        <KeyboardControls />

        {/* Camera Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={3000}
          maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
          minPolarAngle={0.1} // Prevent looking straight down
          zoomSpeed={1.2}
          rotateSpeed={0.8}
          panSpeed={0.8}
          target={[0, 0, 0]}
        />

        {/* Development helpers */}
        {import.meta.env.DEV && (
          <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="white"
            />
          </GizmoHelper>
        )}
      </Canvas>

      {/* Info Panel (outside Canvas, positioned absolutely) */}
      <InfoPanel />

      {/* Debug controls hint */}
      <div className="hidden absolute bottom-4 left-4 bg-black/50 text-white text-xs p-2 rounded font-mono">
        <div>WASD/Arrows: Move camera</div>
        <div>Q/E: Up/Down</div>
        <div>Shift: Fast move</div>
        <div className="mt-1 text-green-400">Green sphere = Origin (0,0,0)</div>
      </div>
    </div>
  );
}
