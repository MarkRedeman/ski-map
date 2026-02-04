import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { useTerrainStore } from '@/store/terrainStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid'

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

/**
 * Renders all ski pistes as 3D lines that follow terrain elevation
 */
export function Pistes() {
  const { data: pistes, isLoading } = usePistes()
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const showPistes = useMapStore((s) => s.showPistes)
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const elevationGrid = useTerrainStore((s) => s.elevationGrid)

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
          elevationGrid={elevationGrid}
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
  elevationGrid: ElevationGrid | null
}

/** Height offset above terrain surface (in scene units, ~20m real) */
const PISTE_OFFSET = 2

function PisteLine({ coordinates, difficulty, isHovered, isSelected, elevationGrid }: PisteLineProps) {
  // Convert geo coordinates to local 3D coordinates with terrain elevation
  const points = useMemo(() => {
    return coordinates.map(([lon, lat]) => {
      const result = coordsToLocal([[lon, lat]], 0)
      const [x, , z] = result[0] ?? [0, 0, 0]
      
      // Sample terrain elevation if available, otherwise use flat Y=2
      let y = PISTE_OFFSET
      if (elevationGrid) {
        const terrainY = sampleElevation(elevationGrid, x, z)
        y = terrainY + PISTE_OFFSET
      }
      
      return [x, y, z] as [number, number, number]
    })
  }, [coordinates, elevationGrid])

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
