/**
 * Contour terrain component
 * 
 * Renders topographic contour lines from real Mapbox elevation data.
 * Major contours (every 100m) are thicker and darker.
 * Minor contours (every 50m) are thinner and lighter.
 */

import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useContourLines } from '@/hooks/useContourLines'

// Sölden ski area bounds (extended for surrounding mountains)
const SOLDEN_BOUNDS = {
  minLat: 46.84,
  maxLat: 47.01,
  minLon: 10.9,
  maxLon: 11.2,
}

interface ContourTerrainProps {
  /** Contour interval in meters (default 50) */
  interval?: number
  /** Major contour interval - thicker lines (default 100) */
  majorInterval?: number
  /** Tile zoom level (default 12 = ~16 tiles) */
  zoom?: number
  /** Minor contour line color */
  minorColor?: string
  /** Major contour line color */
  majorColor?: string
}

export function ContourTerrain({
  interval = 50,
  majorInterval = 100,
  zoom = 12,
  minorColor = '#9ca3af',
  majorColor = '#4b5563',
}: ContourTerrainProps) {
  const { data: contours, isLoading, error } = useContourLines({
    ...SOLDEN_BOUNDS,
    zoom,
    interval,
  })

  // Separate major and minor contours for different styling
  const { majorContours, minorContours } = useMemo(() => {
    if (!contours) return { majorContours: [], minorContours: [] }
    
    const major: typeof contours = []
    const minor: typeof contours = []
    
    for (const contour of contours) {
      if (contour.elevation % majorInterval === 0) {
        major.push(contour)
      } else {
        minor.push(contour)
      }
    }
    
    return { majorContours: major, minorContours: minor }
  }, [contours, majorInterval])

  if (isLoading) {
    return (
      <group name="contour-terrain-loading">
        {/* Simple loading indicator - pulsing ring at origin */}
        <mesh position={[0, 5, 0]}>
          <torusGeometry args={[20, 2, 8, 32]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
        </mesh>
      </group>
    )
  }

  if (error) {
    console.error('[ContourTerrain] Failed to load contours:', error)
    return null
  }

  if (!contours || contours.length === 0) {
    console.log('[ContourTerrain] No contours to render')
    return null
  }

  console.log(`[ContourTerrain] Rendering ${contours.length} contour levels, major: ${majorContours.length}, minor: ${minorContours.length}`)
  
  // Count total rings
  const totalRings = contours.reduce((acc, c) => acc + c.rings.length, 0)
  console.log(`[ContourTerrain] Total rings to render: ${totalRings}`)

  return (
    <group name="contour-terrain">
      {/* Minor contours - lighter, thinner */}
      {minorContours.map((contour, ci) =>
        contour.rings.map((ring, ri) => {
          if (ring.length < 2) return null
          return (
            <Line
              key={`minor-${ci}-${ri}`}
              points={ring}
              color={minorColor}
              lineWidth={0.5}
              transparent
              opacity={0.4}
            />
          )
        })
      )}
      
      {/* Major contours - darker, thicker */}
      {majorContours.map((contour, ci) =>
        contour.rings.map((ring, ri) => {
          if (ring.length < 2) return null
          return (
            <Line
              key={`major-${ci}-${ri}`}
              points={ring}
              color={majorColor}
              lineWidth={1.5}
              transparent
              opacity={0.7}
            />
          )
        })
      )}
    </group>
  )
}
