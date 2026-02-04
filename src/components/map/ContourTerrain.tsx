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
import { useTerrainStore } from '@/store/terrainStore'
import { sampleElevation } from '@/lib/geo/elevationGrid'

// Sölden ski area bounds (includes Rettenbach & Tiefenbach glaciers)
const SOLDEN_BOUNDS = {
  minLat: 46.84,
  maxLat: 47.01,
  minLon: 10.86,
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
  
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)

  // Separate major and minor contours for different styling
  // Also project contour points onto actual terrain surface
  const { majorContours, minorContours } = useMemo(() => {
    if (!contours) return { majorContours: [], minorContours: [] }
    
    const major: Array<{ elevation: number; rings: Array<Array<[number, number, number]>> }> = []
    const minor: Array<{ elevation: number; rings: Array<Array<[number, number, number]>> }> = []
    
    for (const contour of contours) {
      // Project each ring onto the terrain surface if elevation grid is available
      const projectedRings = contour.rings.map(ring => 
        ring.map(([x, y, z]) => {
          if (elevationGrid) {
            const terrainY = sampleElevation(elevationGrid, x, z)
            // Use terrain Y + small offset to float above surface
            return [x, terrainY + 1, z] as [number, number, number]
          }
          return [x, y, z] as [number, number, number]
        })
      )
      
      const projectedContour = { elevation: contour.elevation, rings: projectedRings }
      
      if (contour.elevation % majorInterval === 0) {
        major.push(projectedContour)
      } else {
        minor.push(projectedContour)
      }
    }
    
    return { majorContours: major, minorContours: minor }
  }, [contours, majorInterval, elevationGrid])

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
              opacity={0.25}
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
              opacity={0.45}
            />
          )
        })
      )}
    </group>
  )
}
