import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { geoToLocal } from '@/lib/geo/coordinates'

/**
 * Renders the user's current location marker on the 3D map
 */
export function UserMarker() {
  const userLocation = useNavigationStore((s) => s.userLocation)
  const markerRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  // Animate the pulse effect
  useFrame((state) => {
    if (pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.2
      pulseRef.current.scale.setScalar(scale)
      
      // Fade opacity with pulse
      const material = pulseRef.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2
    }
  })

  if (!userLocation) {
    return null
  }

  const [lat, lon, elevation] = userLocation
  const position = geoToLocal(lat, lon, elevation + 10) // Slight elevation above terrain

  return (
    <group position={position}>
      {/* Pulsing outer ring */}
      <Sphere ref={pulseRef} args={[4, 16, 16]}>
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
      </Sphere>
      
      {/* Solid inner marker */}
      <Sphere ref={markerRef} args={[2, 16, 16]}>
        <meshStandardMaterial color="#3b82f6" />
      </Sphere>
      
      {/* Direction indicator */}
      <mesh rotation={[0, 0, 0]} position={[0, 3, 0]}>
        <coneGeometry args={[1.5, 3, 8]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      
      {/* Label */}
      <Html
        position={[0, 8, 0]}
        center
        distanceFactor={50}
        style={{
          pointerEvents: 'none',
        }}
      >
        <div className="rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white shadow-lg whitespace-nowrap">
          You are here
        </div>
      </Html>
    </group>
  )
}
