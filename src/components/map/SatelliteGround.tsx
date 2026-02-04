/**
 * Satellite ground plane component
 * 
 * Renders Mapbox satellite imagery as a textured ground plane.
 */

import { useSatelliteTexture } from '@/hooks/useSatelliteTexture'

// Sölden ski area bounds (same as contours)
const SOLDEN_BOUNDS = {
  minLat: 46.84,
  maxLat: 47.01,
  minLon: 10.9,
  maxLon: 11.2,
}

interface SatelliteGroundProps {
  /** Y position of the ground plane (default 0) */
  yPosition?: number
  /** Tile zoom level (default 12) */
  zoom?: number
  /** Opacity of the satellite layer (default 1) */
  opacity?: number
}

export function SatelliteGround({
  yPosition = 0,
  zoom = 12,
  opacity = 1,
}: SatelliteGroundProps) {
  const { data, isLoading, error } = useSatelliteTexture({
    ...SOLDEN_BOUNDS,
    zoom,
  })

  if (isLoading) {
    return (
      <group name="satellite-ground-loading">
        {/* Loading indicator */}
        <mesh position={[0, yPosition + 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[15, 20, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
        </mesh>
      </group>
    )
  }

  if (error) {
    console.error('[SatelliteGround] Failed to load satellite imagery:', error)
    return null
  }

  if (!data) {
    return null
  }

  const { texture, width, height, center } = data

  return (
    <group name="satellite-ground">
      <mesh
        position={[center[0], yPosition, center[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          transparent={opacity < 1}
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
