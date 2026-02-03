/**
 * RunPath component renders a ski run as a 3D path on the terrain
 * Color-coded by speed with optional playback animation
 */

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Sphere, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SkiRun, RunPoint } from '@/lib/garmin/types'
import { geoToLocal } from '@/lib/geo/coordinates'
import { formatSpeed } from '@/lib/garmin/parser'
import { useMapStore } from '@/stores/useMapStore'
import { sampleElevation } from '@/lib/geo/elevationGrid'

interface RunPathProps {
  run: SkiRun
  showMarkers?: boolean
  animate?: boolean
}

// Speed thresholds for color coding (m/s)
const SPEED_SLOW = 5 // ~18 km/h
const SPEED_MEDIUM = 15 // ~54 km/h

// Colors for speed segments
const COLOR_SLOW = new THREE.Color('#22c55e') // Green
const COLOR_MEDIUM = new THREE.Color('#eab308') // Yellow
const COLOR_FAST = new THREE.Color('#ef4444') // Red
const COLOR_START = new THREE.Color('#22c55e') // Green
const COLOR_END = new THREE.Color('#ef4444') // Red

/**
 * Get color based on speed
 */
function getSpeedColor(speed: number): THREE.Color {
  if (speed < SPEED_SLOW) {
    return COLOR_SLOW
  } else if (speed < SPEED_MEDIUM) {
    // Interpolate between green and yellow
    const t = (speed - SPEED_SLOW) / (SPEED_MEDIUM - SPEED_SLOW)
    return COLOR_SLOW.clone().lerp(COLOR_MEDIUM, t)
  } else {
    // Interpolate between yellow and red
    const t = Math.min(1, (speed - SPEED_MEDIUM) / SPEED_MEDIUM)
    return COLOR_MEDIUM.clone().lerp(COLOR_FAST, t)
  }
}

export function RunPath({ run, showMarkers = true, animate = true }: RunPathProps) {
  const { coordinates } = run
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  
  if (coordinates.length < 2 || !elevationGrid) {
    return null
  }
  
  // Convert coordinates to 3D points with color data, projected onto terrain
  const pathData = useMemo(() => {
    const points: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    
    for (const coord of coordinates) {
      const [x, , z] = geoToLocal(coord.lat, coord.lon, 0)
      // Sample terrain and add offset (O(1) per point!)
      const terrainY = sampleElevation(elevationGrid, x, z)
      points.push(new THREE.Vector3(x, terrainY + 3, z))
      colors.push(getSpeedColor(coord.speed ?? 0))
    }
    
    return { points, colors }
  }, [coordinates, elevationGrid])
  
  // Create segments for color-coded line
  const segments = useMemo(() => {
    const segs: Array<{
      points: [THREE.Vector3, THREE.Vector3]
      color: THREE.Color
    }> = []
    
    for (let i = 0; i < pathData.points.length - 1; i++) {
      const p1 = pathData.points[i]
      const p2 = pathData.points[i + 1]
      const c = pathData.colors[i + 1]
      if (p1 && p2 && c) {
        segs.push({
          points: [p1, p2],
          color: c, // Use color of destination point
        })
      }
    }
    
    return segs
  }, [pathData])
  
  // Start and end positions
  const startPos = pathData.points[0]
  const endPos = pathData.points[pathData.points.length - 1]
  
  // Don't render if we don't have valid positions
  if (!startPos || !endPos) {
    return null
  }
  
  return (
    <group name="run-path">
      {/* Main path - color-coded segments */}
      {segments.map((segment, i) => (
        <Line
          key={i}
          points={segment.points}
          color={segment.color}
          lineWidth={3}
          opacity={0.9}
          transparent
        />
      ))}
      
      {/* Glow effect - single color */}
      <Line
        points={pathData.points}
        color="#3b82f6"
        lineWidth={6}
        opacity={0.2}
        transparent
      />
      
      {/* Start marker */}
      {showMarkers && (
        <group position={startPos}>
          <Sphere args={[4, 16, 16]}>
            <meshStandardMaterial
              color={COLOR_START}
              emissive={COLOR_START}
              emissiveIntensity={0.3}
            />
          </Sphere>
          <Html
            position={[0, 10, 0]}
            center
            distanceFactor={200}
            occlude
          >
            <div className="whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs font-medium text-white shadow-lg">
              Start
            </div>
          </Html>
        </group>
      )}
      
      {/* End marker */}
      {showMarkers && (
        <group position={endPos}>
          <Sphere args={[4, 16, 16]}>
            <meshStandardMaterial
              color={COLOR_END}
              emissive={COLOR_END}
              emissiveIntensity={0.3}
            />
          </Sphere>
          <Html
            position={[0, 10, 0]}
            center
            distanceFactor={200}
            occlude
          >
            <div className="whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-lg">
              Finish
            </div>
          </Html>
        </group>
      )}
      
      {/* Animated playback marker */}
      {animate && <PlaybackMarker points={pathData.points} coordinates={coordinates} />}
    </group>
  )
}

interface PlaybackMarkerProps {
  points: THREE.Vector3[]
  coordinates: RunPoint[]
}

/**
 * Animated marker that travels along the path showing speed
 */
function PlaybackMarker({ points, coordinates }: PlaybackMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const progressRef = useRef(0)
  const currentSpeedRef = useRef(0)
  const [showInfo, setShowInfo] = useState(false)
  
  // Create smooth curve from points
  const curve = useMemo(() => {
    if (points.length < 2) return null
    return new THREE.CatmullRomCurve3(points)
  }, [points])
  
  // Animate along the path - no setState calls!
  useFrame((_, delta) => {
    if (!meshRef.current || !curve || !materialRef.current) return
    
    // Update progress (complete loop in ~10 seconds)
    progressRef.current = (progressRef.current + delta * 0.1) % 1
    
    // Get position on curve
    const point = curve.getPoint(progressRef.current)
    meshRef.current.position.copy(point)
    
    // Get speed at current position and update material color directly
    const coordIndex = Math.floor(progressRef.current * (coordinates.length - 1))
    const coord = coordinates[coordIndex]
    if (coord?.speed !== undefined) {
      currentSpeedRef.current = coord.speed
      const color = getSpeedColor(coord.speed)
      materialRef.current.color.copy(color)
      materialRef.current.emissive.copy(color)
    }
  })
  
  if (!curve || points.length < 2) return null
  
  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setShowInfo(true)}
        onPointerLeave={() => setShowInfo(false)}
      >
        <sphereGeometry args={[3, 16, 16]} />
        <meshStandardMaterial
          ref={materialRef}
          color={COLOR_SLOW}
          emissive={COLOR_SLOW}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Speed info tooltip - only shown on hover */}
      {showInfo && meshRef.current && (
        <Html
          position={meshRef.current.position.toArray()}
          center
          distanceFactor={150}
        >
          <div className="whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg">
            {formatSpeed(currentSpeedRef.current)}
          </div>
        </Html>
      )}
    </group>
  )
}
