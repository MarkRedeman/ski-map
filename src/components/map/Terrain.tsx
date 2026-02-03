import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getSoldenBounds } from '@/lib/geo/coordinates'
import { createElevationGrid } from '@/lib/geo/elevationGrid'
import { useMapStore } from '@/stores/useMapStore'

/**
 * Color palette for elevation-based terrain coloring
 * Creates a realistic snow-covered mountain look
 */
const TERRAIN_COLORS = {
  valley: new THREE.Color('#8B9A7D'),    // Greenish gray for valley
  lowSlope: new THREE.Color('#C5CCC0'),  // Light gray-green transition
  snow: new THREE.Color('#F8FAFC'),       // Bright snow white
  highSnow: new THREE.Color('#E2E8F0'),   // Slightly blue-tinted snow
  peak: new THREE.Color('#CBD5E1'),       // Ice/rock at peaks
}

/**
 * Get terrain color based on elevation
 */
function getElevationColor(elevation: number, maxElevation: number): THREE.Color {
  const normalizedHeight = elevation / maxElevation
  
  if (normalizedHeight < 0.1) {
    // Valley - greenish
    return TERRAIN_COLORS.valley.clone().lerp(TERRAIN_COLORS.lowSlope, normalizedHeight / 0.1)
  } else if (normalizedHeight < 0.3) {
    // Lower slopes - transition to snow
    const t = (normalizedHeight - 0.1) / 0.2
    return TERRAIN_COLORS.lowSlope.clone().lerp(TERRAIN_COLORS.snow, t)
  } else if (normalizedHeight < 0.7) {
    // Main ski area - bright snow
    return TERRAIN_COLORS.snow.clone()
  } else if (normalizedHeight < 0.9) {
    // High altitude - slightly blue tint
    const t = (normalizedHeight - 0.7) / 0.2
    return TERRAIN_COLORS.snow.clone().lerp(TERRAIN_COLORS.highSnow, t)
  } else {
    // Peaks - icy/rocky
    const t = (normalizedHeight - 0.9) / 0.1
    return TERRAIN_COLORS.highSnow.clone().lerp(TERRAIN_COLORS.peak, t)
  }
}

/**
 * Terrain mesh for the Sölden ski area with elevation-based coloring
 * 
 * In a production app, this would fetch Mapbox terrain-RGB tiles
 * and create a detailed elevation mesh. For now, we create a 
 * procedural terrain that approximates mountain slopes.
 */
export function Terrain() {
  const bounds = getSoldenBounds()
  const meshRef = useRef<THREE.Mesh>(null)
  const setTerrainMesh = useMapStore((s) => s.setTerrainMesh)
  const setElevationGrid = useMapStore((s) => s.setElevationGrid)
  const clearSelection = useMapStore((s) => s.clearSelection)
  
  // Register terrain mesh and elevation grid with store
  useEffect(() => {
    if (meshRef.current) {
      setTerrainMesh(meshRef.current)
      // Create elevation grid for fast O(1) height lookups
      const grid = createElevationGrid(meshRef.current)
      setElevationGrid(grid)
    }
    return () => {
      setTerrainMesh(null)
      setElevationGrid(null)
    }
  }, [setTerrainMesh, setElevationGrid])
  
  const geometry = useMemo(() => {
    const segments = 128 // Higher resolution for smoother terrain
    const width = bounds.width || 500
    const depth = bounds.depth || 500
    
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments)
    
    // Rotate to be horizontal (XZ plane)
    geo.rotateX(-Math.PI / 2)
    
    // Apply procedural elevation and vertex colors
    const positions = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(positions.count * 3)
    
    let maxElevation = 0
    
    // First pass - calculate elevations and find max
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const z = positions.getZ(i)
        
        // Create mountain-like elevation using multiple octaves of noise
        let elevation = 0
        
        // Large-scale mountain shape
        const distFromCenter = Math.sqrt(x * x + z * z)
        elevation += Math.max(0, 120 - distFromCenter * 0.25)
        
        // Ridge pattern (higher on one side - simulates mountain range)
        elevation += Math.sin(x * 0.015 + 0.5) * 40
        elevation += Math.cos(z * 0.012) * 25
        
        // Add some variation (multiple octaves for natural look)
        elevation += Math.sin(x * 0.05 + z * 0.03) * 15
        elevation += Math.sin(x * 0.08 - z * 0.06) * 10
        elevation += Math.sin(x * 0.12 + z * 0.09) * 5
        
        // Valley in the middle (where village would be)
        if (distFromCenter < 60) {
          elevation *= 0.3 + (distFromCenter / 60) * 0.7
        }
        
        // Add some random-looking bumps using sin combinations
        elevation += Math.sin(x * 0.2) * Math.cos(z * 0.15) * 8
        
        positions.setY(i, elevation)
        maxElevation = Math.max(maxElevation, elevation)
      }
      
      positions.needsUpdate = true
    }
    
    // Second pass - apply colors based on elevation
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const elevation = positions.getY(i)
        const color = getElevationColor(elevation, maxElevation)
        
        // Add slight noise to colors for more natural look
        const x = positions.getX(i)
        const z = positions.getZ(i)
        const noise = (Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.03)
        
        colors[i * 3] = Math.min(1, Math.max(0, color.r + noise))
        colors[i * 3 + 1] = Math.min(1, Math.max(0, color.g + noise))
        colors[i * 3 + 2] = Math.min(1, Math.max(0, color.b + noise))
      }
      
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    
    geo.computeVertexNormals()
    
    return geo
  }, [bounds.width, bounds.depth])

  // Handle click on terrain to clear selection
  const handleClick = () => {
    clearSelection()
  }

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      position={[bounds.centerX, 0, bounds.centerZ]}
      receiveShadow
      onClick={handleClick}
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
