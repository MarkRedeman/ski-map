import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { useMapStore } from '@/stores/useMapStore'
import { coordsToLocal } from '@/lib/geo/coordinates'
import { projectPointsOnGrid, type ElevationGrid } from '@/lib/geo/elevationGrid'

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
  const setHoveredPiste = useMapStore((s) => s.setHoveredPiste)
  const setSelectedPiste = useMapStore((s) => s.setSelectedPiste)
  const elevationGrid = useMapStore((s) => s.elevationGrid)

  const filteredPistes = useMemo(
    () => filterPistesByDifficulty(pistes, enabledDifficulties),
    [pistes, enabledDifficulties]
  )

  if (!showPistes || isLoading || !filteredPistes.length || !elevationGrid) {
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
          onHover={setHoveredPiste}
          onSelect={setSelectedPiste}
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
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  elevationGrid: ElevationGrid
}

function PisteLine({ id, coordinates, difficulty, isHovered, isSelected, onHover, onSelect, elevationGrid }: PisteLineProps) {
  // Convert geo coordinates to local 3D coordinates and project onto terrain
  const points = useMemo(() => {
    const localCoords = coordsToLocal(coordinates, 0)
    // Project points onto terrain with 2m offset above surface (O(1) per point!)
    return projectPointsOnGrid(elevationGrid, localCoords, 2)
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
      onPointerOver={() => onHover(id)}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
    />
  )
}
