import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnChunks, type ChunkElevationMap } from '@/lib/geo/elevationGrid'

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

/**
 * Renders all ski pistes as 3D lines on the terrain
 */
export function Pistes() {
  const { data: pistes, isLoading } = usePistes()
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const showPistes = useMapStore((s) => s.showPistes)
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const chunkElevationMap = useMapStore((s) => s.chunkElevationMap)

  const filteredPistes = useMemo(
    () => filterPistesByDifficulty(pistes, enabledDifficulties),
    [pistes, enabledDifficulties]
  )

  if (!showPistes || isLoading || !filteredPistes.length || !chunkElevationMap) {
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
          chunkElevationMap={chunkElevationMap}
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
  chunkElevationMap: ChunkElevationMap
}

function PisteLine({ coordinates, difficulty, isHovered, isSelected, chunkElevationMap }: PisteLineProps) {
  // Convert geo coordinates to local 3D coordinates and project onto terrain
  const points = useMemo(() => {
    const localCoords = coordsToLocal(coordinates, 0)
    // Project points onto terrain with 2m offset above surface (O(1) per point!)
    return projectPointsOnChunks(chunkElevationMap, localCoords, 2)
  }, [coordinates, chunkElevationMap])

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
