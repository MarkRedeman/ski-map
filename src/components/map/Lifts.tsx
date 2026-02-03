import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'

const LIFT_COLOR = '#f59e0b' // Amber

/**
 * Renders all ski lifts as 3D lines on the terrain
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts()
  const showLifts = useMapStore((s) => s.showLifts)

  if (!showLifts || isLoading || !lifts?.length) {
    return null
  }

  return (
    <group name="lifts">
      {lifts.map((lift) => (
        <LiftLine
          key={lift.id}
          coordinates={lift.coordinates}
          name={lift.name}
        />
      ))}
    </group>
  )
}

interface LiftLineProps {
  coordinates: [number, number][]
  name: string
}

function LiftLine({ coordinates }: LiftLineProps) {
  // Convert geo coordinates to local 3D coordinates
  // Lifts are elevated above terrain
  const points = useMemo(() => {
    const localCoords = coordsToLocal(coordinates, 15)
    return localCoords
  }, [coordinates])

  if (points.length < 2) return null

  return (
    <group>
      {/* Lift cable line */}
      <Line
        points={points}
        color={LIFT_COLOR}
        lineWidth={3}
        dashed
        dashSize={2}
        gapSize={1}
      />
      
      {/* Station markers at start and end */}
      {points[0] && (
        <mesh position={points[0]}>
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={LIFT_COLOR} />
        </mesh>
      )}
      {points[points.length - 1] && (
        <mesh position={points[points.length - 1]}>
          <boxGeometry args={[3, 6, 3]} />
          <meshStandardMaterial color={LIFT_COLOR} />
        </mesh>
      )}
    </group>
  )
}
