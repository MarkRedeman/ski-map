/**
 * PlayerMarker component renders a marker on the 3D map showing
 * the user's position during ride playback. It interpolates position
 * from the ride coordinates based on the current playback time.
 */

import { useMemo, useRef } from 'react'
import { Sphere, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SkiRun, RunPoint } from '@/lib/garmin/types'
import { geoToLocal, SOLDEN_CENTER } from '@/lib/geo/coordinates'
import { formatSpeed } from '@/lib/garmin/parser'
import { useMapStore } from '@/stores/useMapStore'
import { usePlaybackStore } from '@/stores/usePlaybackStore'
import { sampleElevationFromChunks } from '@/lib/geo/elevationGrid'

interface PlayerMarkerProps {
  ride: SkiRun
}

// Speed thresholds for color coding (m/s)
const SPEED_SLOW = 5     // ~18 km/h - green
const SPEED_MEDIUM = 15  // ~54 km/h - yellow
const SPEED_FAST = 30    // ~108 km/h - red

// Colors for speed levels
const COLOR_SLOW = new THREE.Color('#22c55e')   // Green
const COLOR_MEDIUM = new THREE.Color('#eab308') // Yellow
const COLOR_FAST = new THREE.Color('#ef4444')   // Red

// Height offset above terrain for visibility
const TERRAIN_OFFSET = 0

// Marker sizes
const MAIN_SPHERE_RADIUS = 8
const GLOW_SPHERE_RADIUS = 12
const CORE_SPHERE_RADIUS = 3
const BEAM_HEIGHT = 15
const BEAM_RADIUS = 1.5

/**
 * Get color based on speed with smooth interpolation
 */
function getSpeedColor(speed: number): THREE.Color {
  if (speed <= SPEED_SLOW) {
    return COLOR_SLOW.clone()
  } else if (speed <= SPEED_MEDIUM) {
    // Interpolate between green and yellow
    const t = (speed - SPEED_SLOW) / (SPEED_MEDIUM - SPEED_SLOW)
    return COLOR_SLOW.clone().lerp(COLOR_MEDIUM, t)
  } else if (speed <= SPEED_FAST) {
    // Interpolate between yellow and red
    const t = (speed - SPEED_MEDIUM) / (SPEED_FAST - SPEED_MEDIUM)
    return COLOR_MEDIUM.clone().lerp(COLOR_FAST, t)
  } else {
    // Beyond fast threshold - full red
    return COLOR_FAST.clone()
  }
}

/**
 * Interpolate position at a given time in seconds from ride start
 */
function getPositionAtTime(
  coordinates: RunPoint[],
  timeSeconds: number
): {
  lat: number
  lon: number
  elevation: number
  speed: number
} | null {
  if (coordinates.length === 0) return null
  
  const firstPoint = coordinates[0]
  const lastPoint = coordinates[coordinates.length - 1]
  if (!firstPoint || !lastPoint) return null
  
  const startTime = firstPoint.time.getTime()
  const targetTime = startTime + timeSeconds * 1000
  
  // Handle edge cases: before start or after end
  if (targetTime <= startTime) {
    return {
      lat: firstPoint.lat,
      lon: firstPoint.lon,
      elevation: firstPoint.elevation,
      speed: firstPoint.speed ?? 0,
    }
  }
  
  const endTime = lastPoint.time.getTime()
  if (targetTime >= endTime) {
    return {
      lat: lastPoint.lat,
      lon: lastPoint.lon,
      elevation: lastPoint.elevation,
      speed: lastPoint.speed ?? 0,
    }
  }
  
  // Find the two points that bracket the target time
  let prevPoint: RunPoint | null = null
  let nextPoint: RunPoint | null = null
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const curr = coordinates[i]
    const next = coordinates[i + 1]
    if (!curr || !next) continue
    
    const currTime = curr.time.getTime()
    const nextTime = next.time.getTime()
    
    if (currTime <= targetTime && nextTime >= targetTime) {
      prevPoint = curr
      nextPoint = next
      break
    }
  }
  
  // Fallback if no bracketing points found
  if (!prevPoint || !nextPoint) {
    return {
      lat: firstPoint.lat,
      lon: firstPoint.lon,
      elevation: firstPoint.elevation,
      speed: firstPoint.speed ?? 0,
    }
  }
  
  // Calculate interpolation factor
  const prevTime = prevPoint.time.getTime()
  const nextTime = nextPoint.time.getTime()
  const timeDelta = nextTime - prevTime
  const t = timeDelta > 0 ? (targetTime - prevTime) / timeDelta : 0
  
  // Linear interpolation between the two points
  return {
    lat: prevPoint.lat + (nextPoint.lat - prevPoint.lat) * t,
    lon: prevPoint.lon + (nextPoint.lon - prevPoint.lon) * t,
    elevation: prevPoint.elevation + (nextPoint.elevation - prevPoint.elevation) * t,
    speed: (prevPoint.speed ?? 0) + ((nextPoint.speed ?? 0) - (prevPoint.speed ?? 0)) * t,
  }
}

export function PlayerMarker({ ride }: PlayerMarkerProps) {
  const { coordinates } = ride
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const chunkElevationMap = useMapStore((s) => s.chunkElevationMap)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  
  // Calculate interpolated position based on current playback time
  const markerData = useMemo(() => {
    if (coordinates.length === 0) return null
    
    const position = getPositionAtTime(coordinates, currentTime)
    if (!position) return null
    
    // Convert to local 3D coordinates
    const [x, , z] = geoToLocal(position.lat, position.lon, 0)
    
    // Sample terrain height if available, otherwise use GPS elevation
    let y: number
    if (chunkElevationMap) {
      const terrainY = sampleElevationFromChunks(chunkElevationMap, x, z)
      y = terrainY + TERRAIN_OFFSET
    } else {
      // Fallback: use GPS elevation relative to Sölden center, scaled (SCALE = 0.1)
      y = (position.elevation - SOLDEN_CENTER.elevation) * 0.1 + TERRAIN_OFFSET
    }
    
    // Get speed color
    const color = getSpeedColor(position.speed)
    
    return {
      position: new THREE.Vector3(x, y, z),
      speed: position.speed,
      color,
    }
  }, [coordinates, currentTime, chunkElevationMap])
  
  // Don't render if no valid position
  if (!markerData) return null
  
  // Update material colors directly to avoid re-renders
  if (materialRef.current) {
    materialRef.current.color.copy(markerData.color)
    materialRef.current.emissive.copy(markerData.color)
  }
  if (glowMaterialRef.current) {
    glowMaterialRef.current.color.copy(markerData.color)
  }
  
  return (
    <group name="player-marker" position={markerData.position}>
      {/* Vertical beam/pillar shooting up from position - very visible */}
      <mesh position={[0, BEAM_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BEAM_RADIUS, BEAM_RADIUS * 1.5, BEAM_HEIGHT, 16]} />
        <meshBasicMaterial
          color={markerData.color}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Outer glow ring at base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <ringGeometry args={[GLOW_SPHERE_RADIUS, GLOW_SPHERE_RADIUS + 8, 32]} />
        <meshBasicMaterial
          color={markerData.color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Main sphere - player position */}
      <Sphere args={[MAIN_SPHERE_RADIUS, 32, 32]}>
        <meshStandardMaterial
          ref={materialRef}
          color={markerData.color}
          emissive={markerData.color}
          emissiveIntensity={0.8}
          metalness={0.2}
          roughness={0.3}
        />
      </Sphere>
      
      {/* Outer glow sphere */}
      <Sphere args={[GLOW_SPHERE_RADIUS, 24, 24]}>
        <meshBasicMaterial
          ref={glowMaterialRef}
          color={markerData.color}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </Sphere>
      
      {/* Inner bright core */}
      <Sphere args={[CORE_SPHERE_RADIUS, 16, 16]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      
      {/* Top beacon sphere at top of beam */}
      <Sphere args={[CORE_SPHERE_RADIUS * 1.5, 16, 16]} position={[0, BEAM_HEIGHT, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      
      {/* Speed label floating above marker */}
      <Html
        position={[0, BEAM_HEIGHT + 5, 0]}
        center
        distanceFactor={200}
        zIndexRange={[100, 0]}
      >
        <div className="pointer-events-none whitespace-nowrap rounded-full bg-slate-900/95 px-4 py-2 text-base font-bold text-white shadow-xl backdrop-blur-sm border-2 border-white/30">
          {formatSpeed(markerData.speed)}
        </div>
      </Html>
      
      {/* Direction indicator - cone pointing in direction of travel */}
      <DirectionIndicator
        coordinates={coordinates}
        currentTime={currentTime}
        color={markerData.color}
      />
    </group>
  )
}

interface DirectionIndicatorProps {
  coordinates: RunPoint[]
  currentTime: number
  color: THREE.Color
}

/**
 * Small arrow/cone indicating direction of travel
 */
function DirectionIndicator({ coordinates, currentTime, color }: DirectionIndicatorProps) {
  const direction = useMemo(() => {
    if (coordinates.length < 2) return null
    
    const firstPoint = coordinates[0]
    if (!firstPoint) return null
    
    const startTime = firstPoint.time.getTime()
    const targetTime = startTime + currentTime * 1000
    
    // Find current and next point for direction
    for (let i = 0; i < coordinates.length - 1; i++) {
      const curr = coordinates[i]
      const next = coordinates[i + 1]
      if (!curr || !next) continue
      
      const currTime = curr.time.getTime()
      const nextTime = next.time.getTime()
      
      if (currTime <= targetTime && nextTime >= targetTime) {
        // Calculate direction from curr to next
        const [x1, , z1] = geoToLocal(curr.lat, curr.lon, 0)
        const [x2, , z2] = geoToLocal(next.lat, next.lon, 0)
        
        const dx = x2 - x1
        const dz = z2 - z1
        const length = Math.sqrt(dx * dx + dz * dz)
        
        if (length > 0.001) {
          // Calculate rotation angle to point in direction of travel
          const angle = Math.atan2(dx, dz)
          return angle
        }
        break
      }
    }
    
    return null
  }, [coordinates, currentTime])
  
  if (direction === null) return null
  
  return (
    <group position={[0, -5, 0]} rotation={[Math.PI / 2, direction, 0]}>
      {/* Larger cone pointing in direction of travel */}
      <mesh>
        <coneGeometry args={[8, 20, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  )
}
