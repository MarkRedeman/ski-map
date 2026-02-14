/**
 * PeakLabels component - renders mountain peak labels with smart visibility
 * 
 * Features:
 * - Badge-style labels with mountain icon and elevation
 * - Only shows peaks near ski lifts (within proximity radius)
 * - Smart distance-based filtering: shows more peaks when zoomed in
 * - Uses terrain elevation sampling for accurate Y positioning
 */

import { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { usePeaks } from '@/hooks/usePeaks'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { geoToLocal, SOLDEN_CENTER } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'

const SCALE = 0.1 // Same scale factor as coordinates.ts

/** Only show peaks within this distance (meters) of a lift */
const PEAK_PROXIMITY_RADIUS = 500

/**
 * Calculate approximate distance between two geo points in meters
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const latDiff = (lat2 - lat1) * 111000 // ~111km per degree latitude
  const lonDiff = (lon2 - lon1) * 111000 * Math.cos(lat1 * Math.PI / 180)
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)
}

/**
 * Get minimum elevation threshold based on camera distance
 * Closer camera = show more peaks, farther camera = show only highest peaks
 */
function getMinElevation(cameraDistance: number): number {
  if (cameraDistance < 400) return 0        // Close: all nearby peaks
  if (cameraDistance < 800) return 2600     // Medium: higher peaks
  return 2900                                // Far: only major peaks
}

/**
 * Quantize camera distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(distance: number): number {
  if (distance < 400) return 0
  if (distance < 800) return 1
  return 2
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
      distanceFactor={200}
      zIndexRange={[50, 0]}
    >
      <div className="pointer-events-none flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm shadow-lg">
        <span className="text-base">⛰️</span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white whitespace-nowrap">{name}</span>
          <span className="text-xs text-white/70">{elevation.toLocaleString()}m</span>
        </div>
      </div>
    </Html>
  )
}

export function PeakLabels() {
  const { data: peaks } = usePeaks()
  const { data: lifts } = useLifts()
  const elevationGrid = useMapStore((s) => s.elevationGrid)
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
  
  // Get all lift coordinates (all points along lift lines, not just stations)
  const liftPoints = useMemo(() => {
    if (!lifts) return []
    return lifts.flatMap(lift => 
      lift.coordinates.map(([lon, lat]) => ({ lat, lon }))
    )
  }, [lifts])
  
  // Filter peaks to only those near lifts, then by elevation
  const visiblePeaks = useMemo(() => {
    if (!peaks || !showLabels || liftPoints.length === 0) return []
    
    const minElevation = getMinElevation(
      distanceLevel === 0 ? 0 : distanceLevel === 1 ? 600 : 1500
    )
    
    return peaks
      // First filter by proximity to lifts
      .filter((peak) => 
        liftPoints.some(point => 
          geoDistance(peak.lat, peak.lon, point.lat, point.lon) < PEAK_PROXIMITY_RADIUS
        )
      )
      // Then filter by elevation threshold
      .filter((peak): peak is typeof peak & { elevation: number } =>
        peak.elevation != null && peak.elevation >= minElevation
      )
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
  }, [peaks, liftPoints, elevationGrid, showLabels, distanceLevel])
  
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
