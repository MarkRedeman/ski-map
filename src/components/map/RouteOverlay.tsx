/**
 * RouteOverlay component renders the selected route as a highlighted 3D path
 * with animation to show direction of travel
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnGrid, sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid'

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
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  
  if (!selectedRoute || selectedRoute.steps.length === 0 || !elevationGrid) {
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
          elevationGrid={elevationGrid}
        />
      ))}
      
      {/* Animated direction indicator */}
      <RouteAnimation steps={selectedRoute.steps} elevationGrid={elevationGrid} />
    </group>
  )
}

interface RouteSegmentProps {
  fromCoords: [number, number, number]
  toCoords: [number, number, number]
  type: 'piste' | 'lift'
  index: number
  totalSteps: number
  elevationGrid: ElevationGrid
}

/**
 * Individual route segment rendered as a thick line
 */
function RouteSegment({ fromCoords, toCoords, type, elevationGrid }: RouteSegmentProps) {
  // Convert geo coords to local 3D coords and project onto terrain
  const points = useMemo(() => {
    const fromLocal = coordsToLocal([[fromCoords[1], fromCoords[0]]], 0)[0]
    const toLocal = coordsToLocal([[toCoords[1], toCoords[0]]], 0)[0]
    
    if (!fromLocal || !toLocal) return []
    
    // Project onto terrain with offset (higher for lifts) - O(1) per point!
    const offset = type === 'lift' ? 12 : 5
    const projected = projectPointsOnGrid(elevationGrid, [fromLocal, toLocal], offset)
    
    return projected
  }, [fromCoords, toCoords, type, elevationGrid])
  
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
  elevationGrid: ElevationGrid
}

/**
 * Animated sphere that travels along the route
 */
function RouteAnimation({ steps, elevationGrid }: RouteAnimationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef(0)
  
  // Build path from all steps and project onto terrain
  const pathPoints = useMemo(() => {
    const points: THREE.Vector3[] = []
    
    for (const step of steps) {
      const fromLocal = coordsToLocal(
        [[step.from.coordinates[1], step.from.coordinates[0]]],
        0
      )[0]
      
      if (fromLocal) {
        const y = sampleElevation(elevationGrid, fromLocal[0], fromLocal[2]) + 8
        points.push(new THREE.Vector3(fromLocal[0], y, fromLocal[2]))
      }
    }
    
    // Add final point
    const lastStep = steps[steps.length - 1]
    if (lastStep) {
      const toLocal = coordsToLocal(
        [[lastStep.to.coordinates[1], lastStep.to.coordinates[0]]],
        0
      )[0]
      
      if (toLocal) {
        const y = sampleElevation(elevationGrid, toLocal[0], toLocal[2]) + 8
        points.push(new THREE.Vector3(toLocal[0], y, toLocal[2]))
      }
    }
    
    return points
  }, [steps, elevationGrid])
  
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
