import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Suspense } from 'react'
import { Terrain } from './Terrain'
import { Pistes } from './Pistes'
import { Lifts } from './Lifts'
import { UserMarker } from './UserMarker'
export function SkiMap3D() {
  return (
    <Canvas
      camera={{
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
      <fog attach="fog" args={['#87ceeb', 500, 2000]} />
      
      {/* 3D Content */}
      <Suspense fallback={null}>
        <Terrain />
        <Pistes />
        <Lifts />
        <UserMarker />
      </Suspense>
      
      {/* Camera Controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={50}
        maxDistance={1000}
        maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
        target={[0, 0, 0]}
      />
      
      {/* Development helpers */}
      {import.meta.env.DEV && (
        <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
        </GizmoHelper>
      )}
    </Canvas>
  )
}
