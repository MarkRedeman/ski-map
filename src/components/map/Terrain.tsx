import { useMemo } from 'react'
import * as THREE from 'three'
import { getSoldenBounds } from '@/lib/geo/coordinates'

/**
 * Simplified terrain mesh for the Sölden ski area
 * 
 * In a production app, this would fetch Mapbox terrain-RGB tiles
 * and create a detailed elevation mesh. For now, we create a 
 * procedural terrain that approximates mountain slopes.
 */
export function Terrain() {
  const bounds = getSoldenBounds()
  
  const geometry = useMemo(() => {
    const segments = 100
    const width = bounds.width || 500
    const depth = bounds.depth || 500
    
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments)
    
    // Rotate to be horizontal (XZ plane)
    geo.rotateX(-Math.PI / 2)
    
    // Apply procedural elevation
    const positions = geo.attributes.position
    
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const z = positions.getZ(i)
        
        // Create mountain-like elevation using multiple octaves of noise
        let elevation = 0
        
        // Large-scale mountain shape
        const distFromCenter = Math.sqrt(x * x + z * z)
        elevation += Math.max(0, 100 - distFromCenter * 0.3)
        
        // Ridge pattern (higher on one side)
        elevation += Math.sin(x * 0.02) * 30
        
        // Add some variation
        elevation += Math.sin(x * 0.05 + z * 0.03) * 15
        elevation += Math.sin(x * 0.08 - z * 0.06) * 10
        
        // Valley in the middle (where village would be)
        if (distFromCenter < 50) {
          elevation *= distFromCenter / 50
        }
        
        positions.setY(i, elevation)
      }
      
      positions.needsUpdate = true
    }
    
    geo.computeVertexNormals()
    
    return geo
  }, [bounds.width, bounds.depth])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#f5f5f5"
        roughness={0.9}
        metalness={0}
        flatShading
      />
    </mesh>
  )
}
