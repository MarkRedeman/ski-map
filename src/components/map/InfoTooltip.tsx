/**
 * InfoTooltip component - displays entity info on hover
 * Positioned near the hovered element in 3D space
 * Styled to match the dark glass theme of MapLegend
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useMapStore } from '@/stores/useMapStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { usePeaks } from '@/hooks/usePeaks'
import { usePlaces } from '@/hooks/usePlaces'
import { coordsToLocal, geoToLocal } from '@/lib/geo/coordinates'
import { sampleElevation } from '@/lib/geo/elevationGrid'
import { PISTE_DIFFICULTY_CONFIG } from './Pistes'
import { LIFT_TYPE_CONFIG } from './Lifts'
import type { ElevationGrid } from '@/lib/geo/elevationGrid'

// Shared tooltip wrapper — positions content in 3D space
function TooltipShell({
  position,
  onClick,
  children,
}: {
  position: [number, number, number]
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div
        onClick={onClick}
        className="cursor-pointer flex min-w-[140px] flex-col gap-1.5 rounded-lg bg-black/80 p-3 backdrop-blur-md transition-colors hover:bg-black/90"
      >
        {children}
        <div className="text-[10px] text-white/40">Click for details</div>
      </div>
    </Html>
  )
}

// Calculate 3D position from the midpoint of a [lon, lat][] coordinate array
function midpointPosition(
  coordinates: [number, number][],
  elevationGrid: ElevationGrid,
): [number, number, number] | null {
  if (coordinates.length === 0) return null
  const midIndex = Math.floor(coordinates.length / 2)
  const midCoord = coordinates[midIndex]
  if (!midCoord) return null

  const [x, , z] = coordsToLocal([[midCoord[0], midCoord[1]]], 0)[0]!
  const y = sampleElevation(elevationGrid, x, z) + 20
  return [x, y, z]
}

// Flatten multi-segment piste coordinates to a single [lon, lat][] array
function flattenSegments(segments: [number, number][][]): [number, number][] {
  return segments.flat()
}

// Calculate 3D position from a lat/lon point
function pointPosition(
  lat: number,
  lon: number,
  elevationGrid: ElevationGrid,
): [number, number, number] {
  const [x, , z] = geoToLocal(lat, lon, 0)
  const y = sampleElevation(elevationGrid, x, z) + 20
  return [x, y, z]
}

// Piste tooltip
function PisteTooltip({ id }: { id: string }) {
  const { data: pistes } = usePistes()
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity)

  const piste = pistes?.find((p) => p.id === id) ?? null

  const position = useMemo(() => {
    if (!piste || !elevationGrid) return null
    // Flatten multi-segment coordinates for midpoint calculation
    return midpointPosition(flattenSegments(piste.coordinates), elevationGrid)
  }, [piste, elevationGrid])

  if (!piste || !position) return null

  const config = PISTE_DIFFICULTY_CONFIG[piste.difficulty]

  return (
    <TooltipShell position={position} onClick={() => setSelectedEntity('piste', piste.id)}>
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <h3 className="text-sm font-semibold text-white truncate">{piste.name}</h3>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-white/70">
          {config.label}
          {piste.ref && <span className="ml-1 font-mono text-white/50">#{piste.ref}</span>}
        </span>
        <span className="text-white/50">&bull;</span>
        <span className="text-white/70">{(piste.length / 1000).toFixed(1)} km</span>
      </div>
    </TooltipShell>
  )
}

// Lift tooltip
function LiftTooltip({ id }: { id: string }) {
  const { data: lifts } = useLifts()
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity)

  const lift = lifts?.find((l) => l.id === id) ?? null

  const position = useMemo(() => {
    if (!lift || !elevationGrid) return null
    return midpointPosition(lift.coordinates, elevationGrid)
  }, [lift, elevationGrid])

  if (!lift || !position) return null

  const config = LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']

  return (
    <TooltipShell position={position} onClick={() => setSelectedEntity('lift', lift.id)}>
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-base">{config.icon}</span>
        <h3 className="text-sm font-semibold text-white truncate">{lift.name}</h3>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-white/70">{lift.type}</span>
        <span className="text-white/50">&bull;</span>
        <span className="text-white/70">{(lift.length / 1000).toFixed(1)} km</span>
        {lift.capacity && (
          <>
            <span className="text-white/50">&bull;</span>
            <span className="text-white/70">{lift.capacity}/h</span>
          </>
        )}
      </div>
    </TooltipShell>
  )
}

// Peak tooltip
function PeakTooltip({ id }: { id: string }) {
  const { data: peaks } = usePeaks()
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity)

  const peak = peaks?.find((p) => p.id === id) ?? null

  const position = useMemo(() => {
    if (!peak || !elevationGrid) return null
    return pointPosition(peak.lat, peak.lon, elevationGrid)
  }, [peak, elevationGrid])

  if (!peak || !position) return null

  return (
    <TooltipShell position={position} onClick={() => setSelectedEntity('peak', peak.id)}>
      <div className="flex items-center gap-2">
        <span className="text-base">&#9968;&#65039;</span>
        <h3 className="text-sm font-semibold text-white truncate">{peak.name}</h3>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-white/70">Peak</span>
        {peak.elevation != null && (
          <>
            <span className="text-white/50">&bull;</span>
            <span className="text-white/70">{peak.elevation.toLocaleString()} m</span>
          </>
        )}
      </div>
    </TooltipShell>
  )
}

// Place tooltip
function PlaceTooltip({ id }: { id: string }) {
  const { data: places } = usePlaces()
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity)

  const place = places?.find((p) => p.id === id) ?? null

  const position = useMemo(() => {
    if (!place || !elevationGrid) return null
    return pointPosition(place.lat, place.lon, elevationGrid)
  }, [place, elevationGrid])

  if (!place || !position) return null

  const typeLabel = place.type.charAt(0).toUpperCase() + place.type.slice(1)

  return (
    <TooltipShell position={position} onClick={() => setSelectedEntity('place', place.id)}>
      <div className="flex items-center gap-2">
        <span className="text-base">&#128205;</span>
        <h3 className="text-sm font-semibold text-white truncate">{place.name}</h3>
      </div>
      <div className="text-xs text-white/70">{typeLabel}</div>
    </TooltipShell>
  )
}

// Main InfoTooltip — delegates to type-specific tooltips
export function InfoTooltip() {
  const hoveredEntity = useMapStore((s) => s.hoveredEntity)

  if (!hoveredEntity) return null

  switch (hoveredEntity.type) {
    case 'piste':
      return <PisteTooltip id={hoveredEntity.id} />
    case 'lift':
      return <LiftTooltip id={hoveredEntity.id} />
    case 'peak':
      return <PeakTooltip id={hoveredEntity.id} />
    case 'place':
      return <PlaceTooltip id={hoveredEntity.id} />
    default:
      return null
  }
}
