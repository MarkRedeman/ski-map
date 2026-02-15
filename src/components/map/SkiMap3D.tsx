import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Suspense, useState, useCallback } from 'react';
import { Terrain3D } from './Terrain3D';
import { ContourTerrain } from './ContourTerrain';
import { Pistes } from './Pistes';
import { Lifts } from './Lifts';
import { UserMarker } from './UserMarker';
import { RunPath } from './RunPath';
import { PlayerMarker } from './playback/PlayerMarker';
import { PlaybackCameraFollow } from './playback/PlaybackCameraFollow';
import { PlaybackManager } from './playback/PlaybackManager';
import { InfoTooltip } from './panels/InfoTooltip';
import { InfoPanel } from './panels/InfoPanel';
import { ProximitySelector } from './ProximitySelector';
import { KeyboardControls } from './KeyboardControls';
import { CompassController, CompassUI } from './panels/Compass';
import { PeakLabels } from './PeakLabels';
import { VillageLabels } from './VillageLabels';
import { RestaurantLabels } from './RestaurantLabels';
import { MapControls } from './panels/Controls';
import { CameraNavigator } from './CameraNavigator';
import { SkiAreaBoundary } from './SkiAreaBoundary';
import { useSelectedRun } from '@/hooks/useRuns';
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter';

export function SkiMap3D() {
  const selectedRun = useSelectedRun();
  const { enabledDifficulties } = useDifficultyFilter();

  // Compass state - needs to bridge Canvas (controller) and DOM (UI)
  const [compassRotation, setCompassRotation] = useState(0);
  const [resetToNorth, setResetToNorth] = useState(false);

  const handleCompassClick = useCallback(() => {
    setResetToNorth(true);
    // Reset the trigger after a short delay
    setTimeout(() => setResetToNorth(false), 100);
  }, []);

  // Camera and controls are centered on Giggijoch (0, 0, 0)
  // since all geo coordinates are converted relative to the region center

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

        {/* 3D Content */}
        <Suspense fallback={null}>
          {/* 3D terrain with satellite texture */}
          <Terrain3D />
          {/* Contour lines at actual elevations */}
          <ContourTerrain />
          {/* Pistes and lifts follow terrain */}
          <Pistes enabledDifficulties={enabledDifficulties} />
          <Lifts />
          <UserMarker />
          {/* Render selected ski run if available */}
          {selectedRun && <RunPath run={selectedRun} />}
          {/* Render player marker for ride playback */}
          {selectedRun && <PlayerMarker ride={selectedRun} />}
          {/* Hover tooltip */}
          <InfoTooltip />
          {/* Peak, village, and restaurant labels */}
          <PeakLabels />
          <VillageLabels />
          <RestaurantLabels />
          {/* Ski area boundary polygon (shown on hover) */}
          <SkiAreaBoundary />
          {/* Proximity-based selection handler */}
          <ProximitySelector enabledDifficulties={enabledDifficulties} />
        </Suspense>

        {/* Keyboard Controls */}
        <KeyboardControls />

        {/* Camera Navigator (handles animated focus on selection) */}
        <CameraNavigator />

        {/* Playback Camera Follow (follows player during ride playback) */}
        <PlaybackCameraFollow ride={selectedRun} />

        {/* Playback Manager (advances time during playback) */}
        <PlaybackManager ride={selectedRun} />

        {/* Compass Controller (updates rotation state) */}
        <CompassController onRotationUpdate={setCompassRotation} resetToNorth={resetToNorth} />

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
            <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
          </GizmoHelper>
        )}
      </Canvas>

      {/* Info Panel (outside Canvas, positioned absolutely) */}
      <InfoPanel />

      {/* Compass (outside Canvas, top-right corner) */}
      <CompassUI rotation={compassRotation} onClick={handleCompassClick} />

      {/* Map Controls - layers, filters, quality (outside Canvas, bottom-left corner) */}
      <MapControls />
    </div>
  );
}
