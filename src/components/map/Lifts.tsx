import { useMemo, useState } from 'react'
import { Line } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { useTerrainStore } from '@/store/terrainStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid'

const LIFT_COLOR = '#f59e0b' // Amber
const LIFT_COLOR_HIGHLIGHT = '#fcd34d' // Brighter amber for highlight

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
 * Renders all ski lifts as 3D lines that follow terrain elevation
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts()
  const showLifts = useMapStore((s) => s.showLifts)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)
  const zoomScale = useZoomScale()

  if (!showLifts || isLoading || !lifts?.length) {
    return null
  }

  return (
    <group name="lifts">
      {lifts.map((lift) => (
        <LiftLine
          key={lift.id}
          id={lift.id}
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
  coordinates: [number, number][]
  isHovered: boolean
  isSelected: boolean
  elevationGrid: ElevationGrid | null
  zoomScale: number
}

function LiftLine({ coordinates, isHovered, isSelected, elevationGrid, zoomScale }: LiftLineProps) {
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
  const color = isHighlighted ? LIFT_COLOR_HIGHLIGHT : LIFT_COLOR
  const baseWidth = BASE_LINE_WIDTH * zoomScale
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth

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
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {stationPoints[1] && (
        <mesh position={stationPoints[1]} raycast={() => null}>
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}
