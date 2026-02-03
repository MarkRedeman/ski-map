/**
 * RouteOverlay component renders the selected route as a highlighted 3D path
 * with animation to show direction of travel
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { coordsToLocal } from '@/lib/geo/coordinates'

/** Colors for route segments by type */
const ROUTE_COLORS = {
  piste: '#22c55e', // Green for pistes
  lift: '#f59e0b', // Amber for lifts
  highlight: '#3b82f6', // Blue for animated highlight
}

/**
 * Main RouteOverlay component
 * Renders the selected route with glowing, animated lines
 */
export function RouteOverlay() {
  const selectedRoute = useNavigationStore((s) => s.selectedRoute)
  
  if (!selectedRoute || selectedRoute.steps.length === 0) {
    return null
  }
  
  return (
    <group name="route-overlay">
      {selectedRoute.steps.map((step, index) => (
        <RouteSegment
          key={`${step.from.id}-${step.to.id}-${index}`}
          fromCoords={step.from.coordinates}
          toCoords={step.to.coordinates}
          type={step.type}
          index={index}
          totalSteps={selectedRoute.steps.length}
        />
      ))}
      
      {/* Animated direction indicator */}
      <RouteAnimation steps={selectedRoute.steps} />
    </group>
  )
}

interface RouteSegmentProps {
  fromCoords: [number, number, number]
  toCoords: [number, number, number]
  type: 'piste' | 'lift'
  index: number
  totalSteps: number
}

/**
 * Individual route segment rendered as a thick line
 */
function RouteSegment({ fromCoords, toCoords, type }: RouteSegmentProps) {
  // Convert geo coords to local 3D coords
  // [lat, lon, elevation] -> local [x, y, z]
  const points = useMemo(() => {
    const fromLocal = coordsToLocal(
      [[fromCoords[1], fromCoords[0]]],
      fromCoords[2] + 15 // Raise above terrain
    )[0]
    const toLocal = coordsToLocal(
      [[toCoords[1], toCoords[0]]],
      toCoords[2] + 15
    )[0]
    
    if (!fromLocal || !toLocal) return []
    
    return [fromLocal, toLocal]
  }, [fromCoords, toCoords])
  
  if (points.length < 2) return null
  
  const color = type === 'lift' ? ROUTE_COLORS.lift : ROUTE_COLORS.piste
  
  return (
    <group>
      {/* Glow effect (outer line) */}
      <Line
        points={points}
        color={color}
        lineWidth={8}
        opacity={0.3}
        transparent
      />
      {/* Main line */}
      <Line
        points={points}
        color={color}
        lineWidth={4}
        opacity={0.9}
        transparent
      />
    </group>
  )
}

interface RouteAnimationProps {
  steps: Array<{
    from: { coordinates: [number, number, number] }
    to: { coordinates: [number, number, number] }
  }>
}

/**
 * Animated sphere that travels along the route
 */
function RouteAnimation({ steps }: RouteAnimationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef(0)
  
  // Build path from all steps
  const pathPoints = useMemo(() => {
    const points: THREE.Vector3[] = []
    
    for (const step of steps) {
      const fromLocal = coordsToLocal(
        [[step.from.coordinates[1], step.from.coordinates[0]]],
        step.from.coordinates[2] + 20
      )[0]
      
      if (fromLocal) {
        points.push(new THREE.Vector3(fromLocal[0], fromLocal[1], fromLocal[2]))
      }
    }
    
    // Add final point
    const lastStep = steps[steps.length - 1]
    if (lastStep) {
      const toLocal = coordsToLocal(
        [[lastStep.to.coordinates[1], lastStep.to.coordinates[0]]],
        lastStep.to.coordinates[2] + 20
      )[0]
      
      if (toLocal) {
        points.push(new THREE.Vector3(toLocal[0], toLocal[1], toLocal[2]))
      }
    }
    
    return points
  }, [steps])
  
  // Create curve for smooth animation
  const curve = useMemo(() => {
    if (pathPoints.length < 2) return null
    return new THREE.CatmullRomCurve3(pathPoints)
  }, [pathPoints])
  
  // Animate the sphere along the path
  useFrame((_, delta) => {
    if (!meshRef.current || !curve) return
    
    // Update progress (complete loop in 5 seconds)
    progressRef.current = (progressRef.current + delta * 0.2) % 1
    
    // Get position on curve
    const point = curve.getPoint(progressRef.current)
    meshRef.current.position.copy(point)
  })
  
  if (!curve || pathPoints.length < 2) return null
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[3, 16, 16]} />
      <meshStandardMaterial
        color={ROUTE_COLORS.highlight}
        emissive={ROUTE_COLORS.highlight}
        emissiveIntensity={0.5}
      />
    </mesh>
  )
}
