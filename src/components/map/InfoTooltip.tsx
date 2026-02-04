/**
 * InfoTooltip component - displays piste/lift info on hover
 * Positioned near the hovered element in 3D space
 * Styled to match the dark glass theme of MapLegend
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useMapStore } from '@/stores/useMapStore'
import { useTerrainStore } from '@/store/terrainStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'
import { PISTE_DIFFICULTY_CONFIG } from './Pistes'
import { LIFT_TYPE_CONFIG } from './Lifts'

/**
 * Calculate approximate length of a single segment in meters
 */
function calculateSegmentLength(coordinates: [number, number][]): number {
  let length = 0
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!
    const [lon2, lat2] = coordinates[i]!
    // Haversine approximation
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    length += 6371000 * c // Earth radius in meters
  }
  return length
}

/**
 * Calculate total length of all segments
 */
function calculateTotalLength(segments: [number, number][][]): number {
  return segments.reduce((total, seg) => total + calculateSegmentLength(seg), 0)
}

/**
 * Get the longest segment from a multi-segment piste
 */
function getLongestSegment(segments: [number, number][][]): [number, number][] {
  let longest = segments[0] ?? []
  let longestLen = calculateSegmentLength(longest)
  
  for (const seg of segments) {
    const len = calculateSegmentLength(seg)
    if (len > longestLen) {
      longestLen = len
      longest = seg
    }
  }
  
  return longest
}

export function InfoTooltip() {
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const setSelectedPiste = useMapStore((s) => s.setSelectedPiste)
  const setSelectedLift = useMapStore((s) => s.setSelectedLift)
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()

  // Find hovered piste
  const hoveredPiste = useMemo(() => {
    if (!hoveredPisteId || !pistes) return null
    return pistes.find((p) => p.id === hoveredPisteId) ?? null
  }, [hoveredPisteId, pistes])

  // Find hovered lift
  const hoveredLift = useMemo(() => {
    if (!hoveredLiftId || !lifts) return null
    return lifts.find((l) => l.id === hoveredLiftId) ?? null
  }, [hoveredLiftId, lifts])

  // Calculate tooltip position (middle of the path)
  const position = useMemo(() => {
    if (!elevationGrid) return null

    // Handle piste (multi-segment)
    if (hoveredPiste) {
      const longestSeg = getLongestSegment(hoveredPiste.coordinates)
      if (longestSeg.length === 0) return null
      
      const midIndex = Math.floor(longestSeg.length / 2)
      const midCoord = longestSeg[midIndex]
      if (!midCoord) return null

      const [x, , z] = coordsToLocal([[midCoord[0], midCoord[1]]], 0)[0]!
      const y = sampleElevation(elevationGrid, x, z) + 20
      return [x, y, z] as [number, number, number]
    }

    // Handle lift (single segment)
    if (hoveredLift) {
      const coords = hoveredLift.coordinates
      const midIndex = Math.floor(coords.length / 2)
      const midCoord = coords[midIndex]
      if (!midCoord) return null

      const [x, , z] = coordsToLocal([[midCoord[0], midCoord[1]]], 0)[0]!
      const y = sampleElevation(elevationGrid, x, z) + 20
      return [x, y, z] as [number, number, number]
    }

    return null
  }, [hoveredPiste, hoveredLift, elevationGrid])

  if (!position) return null

  // Render piste tooltip
  if (hoveredPiste) {
    const config = PISTE_DIFFICULTY_CONFIG[hoveredPiste.difficulty]
    const length = hoveredPiste.length ?? calculateTotalLength(hoveredPiste.coordinates)

    const handleClick = () => {
      setSelectedPiste(hoveredPiste.id)
    }

    return (
      <Html position={position} center zIndexRange={[100, 0]}>
        <div 
          onClick={handleClick}
          className="cursor-pointer flex min-w-[140px] flex-col gap-1.5 rounded-lg bg-black/80 p-3 backdrop-blur-md transition-colors hover:bg-black/90"
        >
          {/* Header with color dot and name */}
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <h3 className="text-sm font-semibold text-white truncate">{hoveredPiste.name}</h3>
          </div>
          
          {/* Info row */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/70">
              {config.label}
              {hoveredPiste.ref && <span className="ml-1 font-mono text-white/50">#{hoveredPiste.ref}</span>}
            </span>
            <span className="text-white/50">•</span>
            <span className="text-white/70">{(length / 1000).toFixed(1)} km</span>
          </div>
          
          {/* Hint */}
          <div className="text-[10px] text-white/40">Click for details</div>
        </div>
      </Html>
    )
  }

  // Render lift tooltip
  if (hoveredLift) {
    const config = LIFT_TYPE_CONFIG[hoveredLift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']
    const length = calculateSegmentLength(hoveredLift.coordinates)

    const handleClick = () => {
      setSelectedLift(hoveredLift.id)
    }

    return (
      <Html position={position} center zIndexRange={[100, 0]}>
        <div 
          onClick={handleClick}
          className="cursor-pointer flex min-w-[140px] flex-col gap-1.5 rounded-lg bg-black/80 p-3 backdrop-blur-md transition-colors hover:bg-black/90"
        >
          {/* Header with icon and name */}
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-base">{config.icon}</span>
            <h3 className="text-sm font-semibold text-white truncate">{hoveredLift.name}</h3>
          </div>
          
          {/* Info row */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/70">{hoveredLift.type}</span>
            <span className="text-white/50">•</span>
            <span className="text-white/70">{(length / 1000).toFixed(1)} km</span>
            {hoveredLift.capacity && (
              <>
                <span className="text-white/50">•</span>
                <span className="text-white/70">{hoveredLift.capacity}/h</span>
              </>
            )}
          </div>
          
          {/* Hint */}
          <div className="text-[10px] text-white/40">Click for details</div>
        </div>
      </Html>
    )
  }

  return null
}
