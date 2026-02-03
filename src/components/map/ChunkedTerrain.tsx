/**
 * Chunked Terrain System
 * 
 * Implements a Google Maps-like tile system where terrain chunks are
 * dynamically loaded/unloaded based on camera position and view frustum.
 * 
 * Key concepts:
 * - World is divided into a grid of chunks
 * - Only chunks visible to the camera are rendered
 * - Chunks further from camera use lower LOD (fewer polygons)
 * - Elevation data is generated procedurally per chunk
 */

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMapStore } from '@/stores/useMapStore'
import { createChunkElevationGrid, mergeElevationGrids } from './terrainUtils'

/** Size of each terrain chunk in world units */
export const CHUNK_SIZE = 200

/** How many chunks to render around the camera */
const VIEW_DISTANCE_CHUNKS = 4

/** Segments per chunk (resolution) */
const CHUNK_SEGMENTS = 32

/** How often to check for chunk updates (ms) */
const UPDATE_INTERVAL = 100

interface ChunkKey {
  x: number
  z: number
}

function chunkKeyToString(key: ChunkKey): string {
  return `${key.x},${key.z}`
}

function worldToChunkCoords(worldX: number, worldZ: number): ChunkKey {
  return {
    x: Math.floor(worldX / CHUNK_SIZE),
    z: Math.floor(worldZ / CHUNK_SIZE),
  }
}

function chunkToWorldCoords(chunkX: number, chunkZ: number): { x: number; z: number } {
  return {
    x: chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
    z: chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2,
  }
}

/**
 * Color palette for elevation-based terrain coloring
 */
const TERRAIN_COLORS = {
  valley: new THREE.Color('#8B9A7D'),
  lowSlope: new THREE.Color('#C5CCC0'),
  snow: new THREE.Color('#F8FAFC'),
  highSnow: new THREE.Color('#E2E8F0'),
  peak: new THREE.Color('#CBD5E1'),
}

function getElevationColor(elevation: number, maxElevation: number): THREE.Color {
  const normalizedHeight = elevation / maxElevation
  
  if (normalizedHeight < 0.15) {
    return TERRAIN_COLORS.valley.clone().lerp(TERRAIN_COLORS.lowSlope, normalizedHeight / 0.15)
  } else if (normalizedHeight < 0.35) {
    const t = (normalizedHeight - 0.15) / 0.2
    return TERRAIN_COLORS.lowSlope.clone().lerp(TERRAIN_COLORS.snow, t)
  } else if (normalizedHeight < 0.7) {
    return TERRAIN_COLORS.snow.clone()
  } else if (normalizedHeight < 0.85) {
    const t = (normalizedHeight - 0.7) / 0.15
    return TERRAIN_COLORS.snow.clone().lerp(TERRAIN_COLORS.highSnow, t)
  } else {
    const t = (normalizedHeight - 0.85) / 0.15
    return TERRAIN_COLORS.highSnow.clone().lerp(TERRAIN_COLORS.peak, t)
  }
}

/**
 * Generate procedural elevation for a point
 */
function generateElevation(worldX: number, worldZ: number): number {
  const x = worldX
  const z = worldZ
  
  let elevation = 0
  
  // Base elevation - gentle variation across the whole area
  const distFromCenter = Math.sqrt(x * x + z * z)
  const normalizedDist = distFromCenter / 1000
  elevation += 30 + normalizedDist * 40
  
  // Major mountain ridges
  elevation += Math.sin(x * 0.008 + 0.5) * 60
  elevation += Math.cos(z * 0.007) * 50
  
  // Secondary ridges at different angles
  elevation += Math.sin((x + z) * 0.005) * 35
  elevation += Math.cos((x - z) * 0.006) * 30
  
  // Medium-scale variation
  elevation += Math.sin(x * 0.015 + z * 0.01) * 25
  elevation += Math.sin(x * 0.025 - z * 0.02) * 18
  
  // Fine detail
  elevation += Math.sin(x * 0.05 + z * 0.04) * 10
  elevation += Math.sin(x * 0.1) * Math.cos(z * 0.08) * 6
  
  // Valley through center (Sölden village area)
  const valleyWidth = 120
  const valleyDepth = 50
  const distFromValley = Math.abs(x - 20)
  if (distFromValley < valleyWidth) {
    const valleyFactor = 1 - (distFromValley / valleyWidth)
    elevation -= valleyDepth * valleyFactor * valleyFactor
  }
  
  return Math.max(5, elevation)
}

/**
 * Main chunked terrain component
 */
export function ChunkedTerrain() {
  const { camera } = useThree()
  const [visibleChunks, setVisibleChunks] = useState<ChunkKey[]>([])
  const lastUpdateRef = useRef(0)
  const setTerrainMesh = useMapStore((s) => s.setTerrainMesh)
  const setTerrainGroup = useMapStore((s) => s.setTerrainGroup)
  const setElevationGrid = useMapStore((s) => s.setElevationGrid)
  const chunksRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const groupRef = useRef<THREE.Group>(null)
  
  // Update visible chunks based on camera position
  const updateVisibleChunks = useCallback(() => {
    const cameraPos = camera.position
    const centerChunk = worldToChunkCoords(cameraPos.x, cameraPos.z)
    
    const newVisibleChunks: ChunkKey[] = []
    
    for (let dx = -VIEW_DISTANCE_CHUNKS; dx <= VIEW_DISTANCE_CHUNKS; dx++) {
      for (let dz = -VIEW_DISTANCE_CHUNKS; dz <= VIEW_DISTANCE_CHUNKS; dz++) {
        // Circular view distance
        if (dx * dx + dz * dz <= VIEW_DISTANCE_CHUNKS * VIEW_DISTANCE_CHUNKS) {
          newVisibleChunks.push({
            x: centerChunk.x + dx,
            z: centerChunk.z + dz,
          })
        }
      }
    }
    
    setVisibleChunks(newVisibleChunks)
  }, [camera])
  
  // Update chunks on frame
  useFrame(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current > UPDATE_INTERVAL) {
      lastUpdateRef.current = now
      updateVisibleChunks()
    }
  })
  
  // Initial update
  useEffect(() => {
    updateVisibleChunks()
  }, [updateVisibleChunks])
  
  // Register group reference with store
  useEffect(() => {
    if (groupRef.current) {
      setTerrainGroup(groupRef.current)
    }
    return () => {
      setTerrainGroup(null)
    }
  }, [setTerrainGroup])
  
  // Update elevation grid when chunks change
  useEffect(() => {
    if (chunksRef.current.size > 0) {
      // Use the first chunk as terrain mesh for raycasting (simplified)
      const firstChunk = chunksRef.current.values().next().value
      if (firstChunk) {
        setTerrainMesh(firstChunk)
      }
      
      // Create merged elevation grid from all chunks
      const grids = Array.from(chunksRef.current.values()).map(mesh => 
        createChunkElevationGrid(mesh, CHUNK_SIZE, CHUNK_SEGMENTS)
      )
      if (grids.length > 0) {
        const mergedGrid = mergeElevationGrids(grids)
        setElevationGrid(mergedGrid)
      }
    }
    
    return () => {
      setTerrainMesh(null)
      setElevationGrid(null)
    }
  }, [visibleChunks, setTerrainMesh, setElevationGrid])
  
  return (
    <group name="chunked-terrain" ref={groupRef}>
      {visibleChunks.map((chunk) => (
        <TerrainChunk
          key={chunkKeyToString(chunk)}
          chunkX={chunk.x}
          chunkZ={chunk.z}
          onMeshReady={(mesh) => {
            chunksRef.current.set(chunkKeyToString(chunk), mesh)
          }}
          onMeshRemoved={() => {
            chunksRef.current.delete(chunkKeyToString(chunk))
          }}
        />
      ))}
    </group>
  )
}

interface TerrainChunkProps {
  chunkX: number
  chunkZ: number
  onMeshReady: (mesh: THREE.Mesh) => void
  onMeshRemoved: () => void
}

/**
 * Individual terrain chunk
 */
function TerrainChunk({ chunkX, chunkZ, onMeshReady, onMeshRemoved }: TerrainChunkProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const worldPos = useMemo(() => chunkToWorldCoords(chunkX, chunkZ), [chunkX, chunkZ])
  
  // Generate chunk geometry
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    
    const positions = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(positions.count * 3)
    
    let maxElevation = 0
    
    // First pass - calculate elevations
    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i)
      const localZ = positions.getZ(i)
      
      // Convert to world coordinates
      const worldX = worldPos.x + localX
      const worldZ = worldPos.z + localZ
      
      const elevation = generateElevation(worldX, worldZ)
      positions.setY(i, elevation)
      maxElevation = Math.max(maxElevation, elevation)
    }
    
    positions.needsUpdate = true
    
    // Second pass - apply colors
    for (let i = 0; i < positions.count; i++) {
      const elevation = positions.getY(i)
      const color = getElevationColor(elevation, maxElevation)
      
      const localX = positions.getX(i)
      const localZ = positions.getZ(i)
      const noise = Math.sin(localX * 0.3) * Math.cos(localZ * 0.25) * 0.02
      
      colors[i * 3] = Math.min(1, Math.max(0, color.r + noise))
      colors[i * 3 + 1] = Math.min(1, Math.max(0, color.g + noise))
      colors[i * 3 + 2] = Math.min(1, Math.max(0, color.b + noise))
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    
    return geo
  }, [worldPos])
  
  // Notify parent when mesh is ready/removed
  useEffect(() => {
    if (meshRef.current) {
      onMeshReady(meshRef.current)
    }
    return () => {
      onMeshRemoved()
    }
  }, [onMeshReady, onMeshRemoved])
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[worldPos.x, 0, worldPos.z]}
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        metalness={0.05}
        flatShading={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
