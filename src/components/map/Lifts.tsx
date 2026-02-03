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
  const setHoveredLift = useMapStore((s) => s.setHoveredLift)
  const setSelectedLift = useMapStore((s) => s.setSelectedLift)

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
          name={lift.name}
          elevationGrid={elevationGrid}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
          onHover={setHoveredLift}
          onSelect={setSelectedLift}
        />
      ))}
    </group>
  )
}

interface LiftLineProps {
  id: string
  coordinates: [number, number][]
  name: string
  elevationGrid: ElevationGrid
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

function LiftLine({ id, coordinates, elevationGrid, isHovered, isSelected, onHover, onSelect }: LiftLineProps) {
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

  const handlePointerOver = () => onHover(id)
  const handlePointerOut = () => onHover(null)
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(id)
  }

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
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
      
      {/* Station markers at start and end */}
      {points[0] && (
        <mesh
          position={points[0]}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {points[points.length - 1] && (
        <mesh
          position={points[points.length - 1]}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}
