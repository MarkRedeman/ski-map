import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import { Suspense, useState, useCallback } from "react";
import { Terrain3D } from "./Terrain3D";
import { ContourTerrain } from "./ContourTerrain";
import { Pistes } from "./Pistes";
import { Lifts } from "./Lifts";
import { UserMarker } from "./UserMarker";
import { RouteOverlay } from "./RouteOverlay";
import { RunPath } from "./RunPath";
import { InfoTooltip } from "./InfoTooltip";
import { InfoPanel } from "./InfoPanel";
import { ProximitySelector } from "./ProximitySelector";
import { KeyboardControls } from "./KeyboardControls";
import { ResolutionControl } from "./ResolutionControl";
import { CompassController, CompassUI } from "./Compass";
import { PeakLabels } from "./PeakLabels";
import { PlaceLabels } from "./PlaceLabels";
import { useSelectedRun } from "@/hooks/useRuns";

export function SkiMap3D() {
  const selectedRun = useSelectedRun();
  
  // Compass state - needs to bridge Canvas (controller) and DOM (UI)
  const [compassRotation, setCompassRotation] = useState(0);
  const [resetToNorth, setResetToNorth] = useState(false);
  
  const handleCompassClick = useCallback(() => {
    setResetToNorth(true);
    // Reset the trigger after a short delay
    setTimeout(() => setResetToNorth(false), 100);
  }, []);

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

        {/* 3D Content */}
        <Suspense fallback={null}>
          {/* 3D terrain with satellite texture */}
          <Terrain3D />
          {/* Contour lines at actual elevations */}
          <ContourTerrain />
          {/* Pistes and lifts follow terrain */}
          <Pistes />
          <Lifts />
          <UserMarker />
          <RouteOverlay />
          {/* Render selected ski run if available */}
          {selectedRun && <RunPath run={selectedRun} />}
          {/* Hover tooltip */}
          <InfoTooltip />
          {/* Peak and place labels */}
          <PeakLabels />
          <PlaceLabels />
          {/* Proximity-based selection handler */}
          <ProximitySelector />
        </Suspense>

        {/* Keyboard Controls */}
        <KeyboardControls />
        
        {/* Compass Controller (updates rotation state) */}
        <CompassController 
          onRotationUpdate={setCompassRotation}
          resetToNorth={resetToNorth}
        />

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

      {/* Compass (outside Canvas, top-right corner) */}
      <CompassUI rotation={compassRotation} onClick={handleCompassClick} />

      {/* Resolution Control (outside Canvas, bottom-right corner) */}
      <ResolutionControl />
    </div>
  );
}
