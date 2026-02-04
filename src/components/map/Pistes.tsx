import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { useState } from 'react'
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

/** Brighter colors for highlighted state */
const DIFFICULTY_COLORS_HIGHLIGHT: Record<Difficulty, string> = {
  blue: '#60a5fa',
  red: '#f87171',
  black: '#475569',
}

/** Base line width (in pixels) */
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
    // Calculate distance from camera to origin (center of terrain)
    const distance = camera.position.length()
    // Scale: closer = thicker, farther = thinner
    // At distance 300 (default overview), scale = 1
    // At distance 100, scale = 1.5 (closer, thicker)
    // At distance 600, scale = 0.7 (farther, thinner)
    const newScale = Math.max(0.5, Math.min(2, 300 / distance))
    // Only update if significantly different to avoid re-renders
    if (Math.abs(newScale - scale) > 0.05) {
      setScale(newScale)
    }
  })
  
  return scale
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
  const zoomScale = useZoomScale()

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
          zoomScale={zoomScale}
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
  zoomScale: number
}

/** Height offset above terrain surface (in scene units, ~20m real) */
const PISTE_OFFSET = 2

function PisteLine({ coordinates, difficulty, isHovered, isSelected, elevationGrid, zoomScale }: PisteLineProps) {
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
  const baseWidth = BASE_LINE_WIDTH * zoomScale
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth
  const color = isHighlighted ? DIFFICULTY_COLORS_HIGHLIGHT[difficulty] : DIFFICULTY_COLORS[difficulty]

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      opacity={isHighlighted ? 1 : 0.85}
      transparent
      // Pointer events now handled by ProximitySelector for better UX
      raycast={() => null}
    />
  )
}
