import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'

const LIFT_COLOR = '#f59e0b' // Amber
const LIFT_COLOR_HOVER = '#fbbf24' // Lighter amber

/**
 * Renders all ski lifts as 3D lines
 * DEBUG MODE: No terrain projection, just raw coordinates at Y=5
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts()
  const showLifts = useMapStore((s) => s.showLifts)
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)

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
}

function LiftLine({ coordinates, isHovered, isSelected }: LiftLineProps) {
  // Convert geo coordinates to local 3D coordinates (no terrain projection)
  // Use Y=10 for lifts (above pistes for visibility)
  const points = useMemo(() => {
    return coordinates.map(([lon, lat]) => {
      const result = coordsToLocal([[lon, lat]], 0)
      const [x, , z] = result[0] ?? [0, 0, 0]
      return [x, 10, z] as [number, number, number]
    })
  }, [coordinates])

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
