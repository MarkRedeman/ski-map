/**
 * SkiAreaBoundary - Renders a dashed yellow polygon outline for hovered ski areas
 * 
 * When hovering over a ski area header in the sidebar, this component draws
 * the ski area's boundary polygon on the 3D map.
 * 
 * Features:
 * - Dashed yellow line style
 * - Follows terrain elevation
 * - Only visible on hover
 */

import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useMapStore } from '@/stores/useMapStore'
import { useSkiData } from '@/hooks/useSkiData'
import { useTerrainStore } from '@/store/terrainStore'
import { geoToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'

const BOUNDARY_COLOR = '#FCD34D' // Amber/yellow
const BOUNDARY_LINE_WIDTH = 3
const BOUNDARY_DASH_SIZE = 8
const BOUNDARY_GAP_SIZE = 4
const TERRAIN_OFFSET = 5 // Height above terrain

export function SkiAreaBoundary() {
  const hoveredSkiAreaId = useMapStore((s) => s.hoveredSkiAreaId)
  const { data: skiData } = useSkiData()
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  
  // Find the hovered ski area polygon
  const hoveredSkiArea = useMemo(() => {
    if (!hoveredSkiAreaId || !skiData?.skiAreas) return null
    return skiData.skiAreas.find((area) => area.id === hoveredSkiAreaId) ?? null
  }, [hoveredSkiAreaId, skiData?.skiAreas])
  
  // Convert polygon coordinates to 3D positions
  const boundaryPoints = useMemo(() => {
    if (!hoveredSkiArea?.polygon) return null
    
    const points: [number, number, number][] = []
    
    for (const [lon, lat] of hoveredSkiArea.polygon) {
      const [x, , z] = geoToLocal(lat, lon, 0)
      
      // Sample terrain height
      let y = TERRAIN_OFFSET
      if (elevationGrid) {
        y = sampleElevation(elevationGrid, x, z) + TERRAIN_OFFSET
      }
      
      points.push([x, y, z])
    }
    
    // Close the polygon by adding first point at the end
    if (points.length > 0) {
      points.push(points[0]!)
    }
    
    return points
  }, [hoveredSkiArea, elevationGrid])
  
  if (!boundaryPoints || boundaryPoints.length < 3) return null
  
  return (
    <group name="ski-area-boundary">
      <Line
        points={boundaryPoints}
        color={BOUNDARY_COLOR}
        lineWidth={BOUNDARY_LINE_WIDTH}
        dashed
        dashSize={BOUNDARY_DASH_SIZE}
        gapSize={BOUNDARY_GAP_SIZE}
      />
    </group>
  )
}
