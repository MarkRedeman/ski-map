import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

/**
 * Renders all ski pistes as 3D lines
 * DEBUG MODE: No terrain projection, just raw coordinates at Y=0
 */
export function Pistes() {
  const { data: pistes, isLoading } = usePistes()
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const showPistes = useMapStore((s) => s.showPistes)
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)

  const filteredPistes = useMemo(
    () => filterPistesByDifficulty(pistes, enabledDifficulties),
    [pistes, enabledDifficulties]
  )

  if (!showPistes || isLoading || !filteredPistes.length) {
    return null
  }

  return (
    <group name="pistes">
      {filteredPistes.map((piste) => (
        <PisteLine
          key={piste.id}
          id={piste.id}
          coordinates={piste.coordinates}
          difficulty={piste.difficulty}
          isHovered={hoveredPisteId === piste.id}
          isSelected={selectedPisteId === piste.id}
        />
      ))}
    </group>
  )
}

interface PisteLineProps {
  id: string
  coordinates: [number, number][]
  difficulty: Difficulty
  isHovered: boolean
  isSelected: boolean
}

function PisteLine({ coordinates, difficulty, isHovered, isSelected }: PisteLineProps) {
  // Convert geo coordinates to local 3D coordinates (no terrain projection)
  // Use null elevation to get Y=0 (flat plane for debugging)
  const points = useMemo(() => {
    // Get XZ from geo coords, but set Y=2 (above grid) for all points
    return coordinates.map(([lon, lat]) => {
      const result = coordsToLocal([[lon, lat]], 0)
      const [x, , z] = result[0] ?? [0, 0, 0]
      return [x, 2, z] as [number, number, number]
    })
  }, [coordinates])

  if (points.length < 2) return null

  const isHighlighted = isHovered || isSelected

  return (
    <Line
      points={points}
      color={DIFFICULTY_COLORS[difficulty]}
      lineWidth={isHighlighted ? 5 : 2}
      opacity={isHighlighted ? 1 : 0.8}
      transparent
      // Pointer events now handled by ProximitySelector for better UX
      raycast={() => null}
    />
  )
}
