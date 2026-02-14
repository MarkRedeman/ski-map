import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, Html, Ring } from '@react-three/drei'
import * as THREE from 'three'
import { useRoutePlanningStore } from '@/stores/useRoutePlanningStore'
import { geoToLocal } from '@/lib/geo/coordinates'

// Scale factor from coordinates.ts (meters to scene units)
const SCALE = 0.1

/**
 * Renders the user's current location marker on the 3D map
 * with accuracy circle and device heading indicator.
 * 
 * Reads location, accuracy, and heading from the navigation store.
 */
export function UserMarker() {
  const userLocation = useRoutePlanningStore((s) => s.userLocation)
  const isTracking = useRoutePlanningStore((s) => s.isTrackingLocation)
  const accuracy = useRoutePlanningStore((s) => s.userAccuracy)
  const heading = useRoutePlanningStore((s) => s.userHeading)
  
  const markerRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)
  const coneGroupRef = useRef<THREE.Group>(null)
  const groupRef = useRef<THREE.Group>(null)
  
  // Track previous position for smooth transitions
  const targetPositionRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const currentPositionRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const initializedRef = useRef(false)
  
  // Heading for rotation (from geolocation or device orientation)
  const targetRotationRef = useRef(0)
  const currentRotationRef = useRef(0)

  // Update target position when userLocation changes
  useEffect(() => {
    if (userLocation) {
      const [lat, lon, elevation] = userLocation
      const [x, y, z] = geoToLocal(lat, lon, elevation + 10)
      targetPositionRef.current.set(x, y, z)
      
      // Initialize current position on first location
      if (!initializedRef.current) {
        currentPositionRef.current.copy(targetPositionRef.current)
        initializedRef.current = true
      }
    }
  }, [userLocation])

  // Update target rotation when heading changes
  useEffect(() => {
    if (heading !== null) {
      // Convert heading to radians (heading is 0-360, 0 = north)
      targetRotationRef.current = -(heading * Math.PI) / 180
    }
  }, [heading])

  // Animate the pulse effect and smooth position/rotation transitions
  useFrame((state, delta) => {
    if (pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.2
      pulseRef.current.scale.setScalar(scale)
      
      // Fade opacity with pulse
      const material = pulseRef.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2
    }

    // Smooth position interpolation
    if (groupRef.current && initializedRef.current) {
      currentPositionRef.current.lerp(targetPositionRef.current, Math.min(1, delta * 5))
      groupRef.current.position.copy(currentPositionRef.current)
    }

    // Smooth rotation interpolation for direction cone
    if (coneGroupRef.current && heading !== null) {
      // Lerp rotation
      const angleDiff = targetRotationRef.current - currentRotationRef.current
      
      // Handle wraparound
      let normalizedDiff = angleDiff
      if (Math.abs(angleDiff) > Math.PI) {
        normalizedDiff = angleDiff > 0 ? angleDiff - 2 * Math.PI : angleDiff + 2 * Math.PI
      }
      
      currentRotationRef.current += normalizedDiff * Math.min(1, delta * 5)
      coneGroupRef.current.rotation.y = currentRotationRef.current
    }
  })

  if (!userLocation || !isTracking) {
    return null
  }

  // Convert accuracy to scene units
  const accuracyRadius = accuracy !== null ? Math.max(accuracy * SCALE, 2) : null

  return (
    <group ref={groupRef}>
      {/* Accuracy circle - shows GPS accuracy radius */}
      {accuracyRadius !== null && accuracyRadius > 4 && (
        <Ring
          args={[accuracyRadius - 0.2, accuracyRadius, 64]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.1, 0]}
        >
          <meshBasicMaterial 
            color="#3b82f6" 
            transparent 
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </Ring>
      )}

      {/* Accuracy fill */}
      {accuracyRadius !== null && accuracyRadius > 4 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[accuracyRadius, 64]} />
          <meshBasicMaterial 
            color="#3b82f6" 
            transparent 
            opacity={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Pulsing outer ring */}
      <Sphere ref={pulseRef} args={[4, 16, 16]}>
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
      </Sphere>
      
      {/* Solid inner marker */}
      <Sphere ref={markerRef} args={[2, 16, 16]}>
        <meshStandardMaterial color="#3b82f6" />
      </Sphere>
      
      {/* Direction indicator - rotates with heading */}
      {heading !== null && (
        <group ref={coneGroupRef}>
          <mesh position={[0, 0, -3]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[1.5, 3, 8]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
        </group>
      )}
      
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
