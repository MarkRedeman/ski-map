import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { Terrain } from './Terrain'
import { Pistes } from './Pistes'
import { Lifts } from './Lifts'
import { UserMarker } from './UserMarker'
import { RouteOverlay } from './RouteOverlay'
import { RunPath } from './RunPath'
import { InfoTooltip } from './InfoTooltip'
import { InfoPanel } from './InfoPanel'
import { useSelectedRun } from '@/hooks/useRuns'
import { getSoldenBounds } from '@/lib/geo/coordinates'

export function SkiMap3D() {
  const selectedRun = useSelectedRun()
  
  // Get the actual center of the ski area for camera positioning
  const bounds = useMemo(() => getSoldenBounds(), [])
  
  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{
          position: [bounds.centerX, 300, bounds.centerZ + 400],
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
        <fog attach="fog" args={['#87ceeb', 500, 2500]} />
        
        {/* 3D Content */}
        <Suspense fallback={null}>
          <Terrain />
          <Pistes />
          <Lifts />
          <UserMarker />
          <RouteOverlay />
          {/* Render selected ski run if available */}
          {selectedRun && <RunPath run={selectedRun} />}
          {/* Hover tooltip */}
          <InfoTooltip />
        </Suspense>
        
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
    </div>
  )
}
