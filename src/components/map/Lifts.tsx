import { useMemo, useState } from 'react'
import { Line } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore, type LiftType } from '@/stores/useMapStore'
import { useTerrainStore } from '@/store/terrainStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid'

/** Lift type color configuration */
export const LIFT_TYPE_CONFIG: Record<LiftType, { color: string; colorHighlight: string; icon: string }> = {
  'Gondola': {
    color: '#22c55e',      // Green
    colorHighlight: '#4ade80',
    icon: '🚡',
  },
  'Chair Lift': {
    color: '#3b82f6',      // Blue
    colorHighlight: '#60a5fa',
    icon: '🪑',
  },
  'Cable Car': {
    color: '#a855f7',      // Purple
    colorHighlight: '#c084fc',
    icon: '🚠',
  },
  'T-Bar': {
    color: '#ef4444',      // Red
    colorHighlight: '#f87171',
    icon: '⏸️',
  },
  'Button Lift': {
    color: '#f97316',      // Orange
    colorHighlight: '#fb923c',
    icon: '🔘',
  },
  'Drag Lift': {
    color: '#f97316',      // Orange
    colorHighlight: '#fb923c',
    icon: '↗️',
  },
  'Magic Carpet': {
    color: '#ec4899',      // Pink
    colorHighlight: '#f472b6',
    icon: '🟰',
  },
  'Lift': {
    color: '#f59e0b',      // Amber (default)
    colorHighlight: '#fcd34d',
    icon: '🎿',
  },
}

/** Height offset above terrain for lift cables (in scene units, ~100m real) */
const LIFT_CABLE_OFFSET = 10
/** Height offset above terrain for station buildings */
const LIFT_STATION_OFFSET = 3

/** Base line width for lifts (in pixels) */
const BASE_LINE_WIDTH = 8
/** Highlighted line width multiplier */
const HIGHLIGHT_MULTIPLIER = 2

/**
 * Hook to calculate zoom-based line width scaling
 * Returns a scale factor based on camera distance
 */
function useZoomScale(): number {
  const { camera } = useThree()
  const [scale, setScale] = useState(1)
  
  useFrame(() => {
    const distance = camera.position.length()
    const newScale = Math.max(0.5, Math.min(2, 300 / distance))
    if (Math.abs(newScale - scale) > 0.05) {
      setScale(newScale)
    }
  })
  
  return scale
}

/**
 * Get the config for a lift type, with fallback to default
 */
function getLiftConfig(type: string): { color: string; colorHighlight: string; icon: string } {
  return LIFT_TYPE_CONFIG[type as LiftType] ?? LIFT_TYPE_CONFIG['Lift']
}

/**
 * Renders all ski lifts as 3D lines that follow terrain elevation
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts()
  const showLifts = useMapStore((s) => s.showLifts)
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  const zoomScale = useZoomScale()

  // Filter lifts by visible types
  const visibleLifts = useMemo(() => {
    if (!lifts) return []
    return lifts.filter((lift) => visibleLiftTypes.has(lift.type as LiftType))
  }, [lifts, visibleLiftTypes])

  if (!showLifts || isLoading || !visibleLifts.length) {
    return null
  }

  return (
    <group name="lifts">
      {visibleLifts.map((lift) => (
        <LiftLine
          key={lift.id}
          id={lift.id}
          type={lift.type}
          coordinates={lift.coordinates}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
          elevationGrid={elevationGrid}
          zoomScale={zoomScale}
        />
      ))}
    </group>
  )
}

interface LiftLineProps {
  id: string
  type: string
  coordinates: [number, number][]
  isHovered: boolean
  isSelected: boolean
  elevationGrid: ElevationGrid | null
  zoomScale: number
}

function LiftLine({ type, coordinates, isHovered, isSelected, elevationGrid, zoomScale }: LiftLineProps) {
  const config = getLiftConfig(type)
  
  // Convert geo coordinates to local 3D coordinates with terrain elevation
  // Lifts are elevated above terrain to simulate cable height
  const { cablePoints, stationPoints } = useMemo(() => {
    const cable: [number, number, number][] = []
    const stations: [number, number, number][] = []
    
    coordinates.forEach(([lon, lat], index) => {
      const result = coordsToLocal([[lon, lat]], 0)
      const [x, , z] = result[0] ?? [0, 0, 0]
      
      // Sample terrain elevation if available
      let terrainY = 0
      if (elevationGrid) {
        terrainY = sampleElevation(elevationGrid, x, z)
      }
      
      // Cable points are high above terrain
      cable.push([x, terrainY + LIFT_CABLE_OFFSET, z])
      
      // Station points only at start and end
      if (index === 0 || index === coordinates.length - 1) {
        stations.push([x, terrainY + LIFT_STATION_OFFSET, z])
      }
    })
    
    return { cablePoints: cable, stationPoints: stations }
  }, [coordinates, elevationGrid])

  if (cablePoints.length < 2) return null

  const isHighlighted = isHovered || isSelected
  const color = isHighlighted ? config.colorHighlight : config.color
  const baseWidth = BASE_LINE_WIDTH * zoomScale
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth

  // Get station geometry based on lift type
  const stationGeometry = getStationGeometry(type)

  return (
    <group>
      {/* Lift cable line */}
      <Line
        points={cablePoints}
        color={color}
        lineWidth={lineWidth}
        dashed
        dashSize={2}
        gapSize={1}
        // Pointer events now handled by ProximitySelector for better UX
        raycast={() => null}
      />
      
      {/* Station markers at start and end */}
      {stationPoints[0] && (
        <mesh position={stationPoints[0]} raycast={() => null}>
          {stationGeometry}
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {stationPoints[1] && (
        <mesh position={stationPoints[1]} raycast={() => null}>
          {stationGeometry}
          <meshStandardMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Returns the appropriate station geometry based on lift type
 */
function getStationGeometry(liftType: string): JSX.Element {
  switch (liftType) {
    case 'Gondola':
    case 'Cable Car':
      // Large building for major lifts
      return <boxGeometry args={[4, 8, 4]} />
    case 'Chair Lift':
      // Medium building
      return <boxGeometry args={[3, 6, 3]} />
    case 'T-Bar':
    case 'Button Lift':
    case 'Drag Lift':
      // Small pole for drag lifts
      return <cylinderGeometry args={[0.5, 0.5, 5, 8]} />
    case 'Magic Carpet':
      // Flat platform
      return <boxGeometry args={[6, 1, 3]} />
    default:
      return <boxGeometry args={[3, 6, 3]} />
  }
}
