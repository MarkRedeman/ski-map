/**
 * InfoTooltip component - displays piste/lift info on hover
 * Positioned near the hovered element in 3D space
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useMapStore } from '@/stores/useMapStore'
import { useTerrainStore } from '@/store/terrainStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'

const DIFFICULTY_LABELS = {
  blue: { label: 'Easy', color: 'text-blue-100', bg: 'bg-blue-500' },
  red: { label: 'Intermediate', color: 'text-red-100', bg: 'bg-red-500' },
  black: { label: 'Expert', color: 'text-gray-100', bg: 'bg-gray-900' },
} as const

/**
 * Calculate approximate length from coordinates in meters
 */
function calculateLength(coordinates: [number, number][]): number {
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

export function InfoTooltip() {
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
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
    const item = hoveredPiste || hoveredLift
    if (!item || !elevationGrid) return null

    const coords = item.coordinates
    const midIndex = Math.floor(coords.length / 2)
    const midCoord = coords[midIndex]
    if (!midCoord) return null

    const [x, , z] = coordsToLocal([[midCoord[0], midCoord[1]]], 0)[0]!
    const y = sampleElevation(elevationGrid, x, z) + 20
    return [x, y, z] as [number, number, number]
  }, [hoveredPiste, hoveredLift, elevationGrid])

  if (!position) return null

  // Render piste tooltip
  if (hoveredPiste) {
    const difficulty = DIFFICULTY_LABELS[hoveredPiste.difficulty]
    const length = calculateLength(hoveredPiste.coordinates)

    return (
      <Html position={position} center zIndexRange={[100, 0]}>
        <div className="pointer-events-none flex min-w-[140px] flex-col gap-1 rounded-lg bg-white/95 p-3 shadow-xl backdrop-blur-sm">
          {/* Header with difficulty badge */}
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${difficulty.bg} ${difficulty.color}`}>
              {hoveredPiste.difficulty.toUpperCase()}
            </span>
            {hoveredPiste.ref && (
              <span className="text-xs font-medium text-gray-500">#{hoveredPiste.ref}</span>
            )}
          </div>
          
          {/* Name */}
          <h3 className="text-sm font-semibold text-gray-900">{hoveredPiste.name}</h3>
          
          {/* Stats */}
          <div className="flex gap-3 text-xs text-gray-600">
            <span>📏 {(length / 1000).toFixed(1)} km</span>
          </div>
          
          {/* Hint */}
          <div className="mt-1 text-[10px] text-gray-400">Click for details</div>
        </div>
      </Html>
    )
  }

  // Render lift tooltip
  if (hoveredLift) {
    const length = calculateLength(hoveredLift.coordinates)

    return (
      <Html position={position} center zIndexRange={[100, 0]}>
        <div className="pointer-events-none flex min-w-[140px] flex-col gap-1 rounded-lg bg-white/95 p-3 shadow-xl backdrop-blur-sm">
          {/* Header with type badge */}
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {hoveredLift.type.toUpperCase()}
            </span>
          </div>
          
          {/* Name */}
          <h3 className="text-sm font-semibold text-gray-900">{hoveredLift.name}</h3>
          
          {/* Stats */}
          <div className="flex gap-3 text-xs text-gray-600">
            <span>📏 {(length / 1000).toFixed(1)} km</span>
            {hoveredLift.capacity && <span>👥 {hoveredLift.capacity}/h</span>}
          </div>
          
          {/* Hint */}
          <div className="mt-1 text-[10px] text-gray-400">Click for details</div>
        </div>
      </Html>
    )
  }

  return null
}
