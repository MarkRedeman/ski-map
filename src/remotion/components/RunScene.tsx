import { useCurrentFrame, useVideoConfig } from 'remotion'
import { ThreeCanvas } from '@remotion/three'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { VideoSkiRun } from '@/types/skiRun'
import { getRunValuesAtTime } from '@/types/skiRun'
import { SOLDEN_CENTER } from '@/config/region'

type RunSceneProps = {
  run: VideoSkiRun
  /** Speed multiplier for playback (default 1 = realtime) */
  speedMultiplier?: number
}

const SCALE = 10 // Scene scale factor

/**
 * 3D scene component for Remotion video
 * Uses ThreeCanvas instead of regular R3F Canvas
 * All animations MUST be driven by useCurrentFrame()
 */
export function RunScene({ run, speedMultiplier = 1 }: RunSceneProps) {
  const { width, height, fps } = useVideoConfig()
  const frame = useCurrentFrame()

  // Calculate current time in the run based on frame
  const currentTimeSeconds = (frame / fps) * speedMultiplier
  
  // Get interpolated values at current time
  const runValues = useMemo(
    () => getRunValuesAtTime(run, currentTimeSeconds),
    [run, currentTimeSeconds]
  )

  // Convert position to scene coordinates
  const scenePosition = useMemo(() => {
    return geoToScene(
      runValues.position[0],
      runValues.position[1],
      runValues.position[2]
    )
  }, [runValues.position])

  // Camera follows the skier with offset
  const cameraPosition = useMemo((): [number, number, number] => {
    return [
      scenePosition[0] - 5,
      scenePosition[1] + 8,
      scenePosition[2] + 12,
    ]
  }, [scenePosition])

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        position: cameraPosition,
        fov: 50,
        near: 0.1,
        far: 2000,
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 100, 30]}
        intensity={1.2}
        castShadow
      />
      <hemisphereLight
        color="#87ceeb"
        groundColor="#445544"
        intensity={0.4}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#87ceeb', 50, 300]} />

      {/* Scene contents */}
      <TerrainMesh />
      <RunPathMesh run={run} />
      <SkierMarker position={scenePosition} frame={frame} />
    </ThreeCanvas>
  )
}

/**
 * Simplified terrain for the video
 */
function TerrainMesh() {
  const geometry = useMemo(() => {
    const segments = 50
    const size = 200
    const geo = new THREE.PlaneGeometry(size, size, segments, segments)
    geo.rotateX(-Math.PI / 2)

    const positions = geo.attributes.position
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const z = positions.getZ(i)
        
        // Create gentle slopes
        const distFromCenter = Math.sqrt(x * x + z * z)
        let y = Math.max(0, 50 - distFromCenter * 0.4)
        y += Math.sin(x * 0.05) * 8 + Math.sin(z * 0.07) * 5
        
        positions.setY(i, y)
      }
      positions.needsUpdate = true
    }

    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#e8e8e8"
        roughness={0.95}
        metalness={0}
        flatShading
      />
    </mesh>
  )
}

/**
 * Renders the full run path as a line
 */
function RunPathMesh({ run }: { run: VideoSkiRun }) {
  const lineObject = useMemo(() => {
    let points: THREE.Vector3[]
    
    if (run.points.length < 2) {
      // Generate placeholder path for empty runs
      points = [
        new THREE.Vector3(0, 25, -30),
        new THREE.Vector3(5, 20, -20),
        new THREE.Vector3(3, 15, -10),
        new THREE.Vector3(8, 10, 0),
        new THREE.Vector3(5, 5, 10),
        new THREE.Vector3(10, 2, 20),
      ]
    } else {
      points = run.points.map((point) => {
        const [x, y, z] = geoToScene(point.lat, point.lon, point.elevation)
        return new THREE.Vector3(x, y + 0.5, z)
      })
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ color: '#ef4444' })
    return new THREE.Line(geometry, material)
  }, [run.points])

  return <primitive object={lineObject} />
}

/**
 * Animated skier marker
 */
function SkierMarker({ 
  position, 
  frame 
}: { 
  position: [number, number, number]
  frame: number
}) {
  // Subtle bobbing animation driven by frame
  const bobOffset = Math.sin(frame * 0.3) * 0.1

  return (
    <group position={[position[0], position[1] + 0.5 + bobOffset, position[2]]}>
      {/* Skier body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>

      {/* Glow effect */}
      <pointLight color="#3b82f6" intensity={2} distance={5} />
    </group>
  )
}

/**
 * Convert geographic coordinates to scene coordinates
 */
function geoToScene(lat: number, lon: number, elevation: number): [number, number, number] {
  const dLat = lat - SOLDEN_CENTER.lat
  const dLon = lon - SOLDEN_CENTER.lon
  
  // Approximate conversion (1 degree ≈ 111km at equator)
  const metersPerDegreeLat = 111320
  const metersPerDegreeLon = 111320 * Math.cos(SOLDEN_CENTER.lat * Math.PI / 180)
  
  const x = dLon * metersPerDegreeLon / SCALE
  const z = -dLat * metersPerDegreeLat / SCALE
  const y = (elevation - SOLDEN_CENTER.elevation) / SCALE + 5
  
  return [x, y, z]
}
