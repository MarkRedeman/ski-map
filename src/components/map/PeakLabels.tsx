/**
 * PeakLabels component - renders mountain peak labels with smart visibility
 * 
 * Features:
 * - Badge-style labels with mountain icon and elevation
 * - Smart distance-based filtering: shows more peaks when zoomed in
 * - Uses terrain elevation sampling for accurate Y positioning
 * - Occlusion: labels hide when behind terrain
 */

import { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { usePeaks } from '@/hooks/usePeaks'
import { useTerrainStore } from '@/store/terrainStore'
import { useMapStore } from '@/stores/useMapStore'
import { geoToLocal, SOLDEN_CENTER } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'

const SCALE = 0.1 // Same scale factor as coordinates.ts

/**
 * Get minimum elevation threshold based on camera distance
 * Closer camera = show more peaks, farther camera = show only highest peaks
 */
function getMinElevation(cameraDistance: number): number {
  if (cameraDistance < 500) return 0        // Show all peaks
  if (cameraDistance < 1000) return 2500    // Major peaks (includes Gigijoch at 2520m)
  if (cameraDistance < 2000) return 2800    // High peaks
  return 3000                                // Only the highest peaks
}

/**
 * Quantize camera distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(distance: number): number {
  if (distance < 500) return 0
  if (distance < 1000) return 1
  if (distance < 2000) return 2
  return 3
}

interface PeakLabelProps {
  name: string
  elevation: number
  position: [number, number, number]
}

function PeakLabel({ name, elevation, position }: PeakLabelProps) {
  return (
    <Html
      position={position}
      center
      distanceFactor={150}
      occlude
      zIndexRange={[50, 0]}
    >
      <div className="pointer-events-none flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 backdrop-blur-sm shadow-lg">
        <span className="text-sm">⛰️</span>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-white whitespace-nowrap">{name}</span>
          <span className="text-[10px] text-white/70">{elevation.toLocaleString()}m</span>
        </div>
      </div>
    </Html>
  )
}

export function PeakLabels() {
  const { data: peaks } = usePeaks()
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  const showLabels = useMapStore((s) => s.showLabels)
  
  // Track camera distance level for filtering (quantized to avoid constant re-renders)
  const [distanceLevel, setDistanceLevel] = useState(2)
  
  // Update distance level based on camera position
  useFrame(({ camera }) => {
    const distance = camera.position.length()
    const newLevel = getDistanceLevel(distance)
    if (newLevel !== distanceLevel) {
      setDistanceLevel(newLevel)
    }
  })
  
  // Filter and position peaks based on camera distance
  const visiblePeaks = useMemo(() => {
    if (!peaks || !showLabels) return []
    
    const minElevation = getMinElevation(distanceLevel === 0 ? 0 : distanceLevel === 1 ? 750 : distanceLevel === 2 ? 1500 : 2500)
    
    return peaks
      .filter((peak) => peak.elevation >= minElevation)
      .map((peak) => {
        // Convert geo coordinates to local 3D position
        const [x, , z] = geoToLocal(peak.lat, peak.lon, 0)
        
        // Get terrain height at this position, or use peak elevation
        let y: number
        if (elevationGrid) {
          const terrainY = sampleElevation(elevationGrid, x, z)
          // Use the higher of terrain height or OSM elevation (in case terrain data is lower res)
          const peakY = (peak.elevation - SOLDEN_CENTER.elevation) * SCALE
          y = Math.max(terrainY, peakY) + 15 // Offset above terrain
        } else {
          y = (peak.elevation - SOLDEN_CENTER.elevation) * SCALE + 15
        }
        
        return {
          ...peak,
          position: [x, y, z] as [number, number, number],
        }
      })
  }, [peaks, elevationGrid, showLabels, distanceLevel])
  
  if (!showLabels || visiblePeaks.length === 0) return null
  
  return (
    <group name="peak-labels">
      {visiblePeaks.map((peak) => (
        <PeakLabel
          key={peak.id}
          name={peak.name}
          elevation={peak.elevation}
          position={peak.position}
        />
      ))}
    </group>
  )
}
