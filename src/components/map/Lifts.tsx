import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnGrid, type ElevationGrid } from '@/lib/geo/elevationGrid'

const LIFT_COLOR = '#f59e0b' // Amber
const LIFT_COLOR_HOVER = '#fbbf24' // Lighter amber

/**
 * Renders all ski lifts as 3D lines on the terrain
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts()
  const showLifts = useMapStore((s) => s.showLifts)
  const elevationGrid = useMapStore((s) => s.elevationGrid)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)

  if (!showLifts || isLoading || !lifts?.length || !elevationGrid) {
    return null
  }

  return (
    <group name="lifts">
      {lifts.map((lift) => (
        <LiftLine
          key={lift.id}
          id={lift.id}
          coordinates={lift.coordinates}
          elevationGrid={elevationGrid}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
        />
      ))}
    </group>
  )
}

interface LiftLineProps {
  id: string
  coordinates: [number, number][]
  elevationGrid: ElevationGrid
  isHovered: boolean
  isSelected: boolean
}

function LiftLine({ coordinates, elevationGrid, isHovered, isSelected }: LiftLineProps) {
  // Convert geo coordinates to local 3D coordinates and project onto terrain
  // Lifts get a higher offset since cables are above the ground
  const points = useMemo(() => {
    const localCoords = coordsToLocal(coordinates, 0)
    // Project onto terrain with 10m offset for lift cables (O(1) per point!)
    return projectPointsOnGrid(elevationGrid, localCoords, 10)
  }, [coordinates, elevationGrid])

  if (points.length < 2) return null

  const isHighlighted = isHovered || isSelected
  const color = isHighlighted ? LIFT_COLOR_HOVER : LIFT_COLOR

  return (
    <group>
      {/* Lift cable line */}
      <Line
        points={points}
        color={color}
        lineWidth={isHighlighted ? 5 : 3}
        dashed
        dashSize={2}
        gapSize={1}
        // Pointer events now handled by ProximitySelector for better UX
        raycast={() => null}
      />
      
      {/* Station markers at start and end */}
      {points[0] && (
        <mesh position={points[0]} raycast={() => null}>
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {points[points.length - 1] && (
        <mesh position={points[points.length - 1]} raycast={() => null}>
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}
