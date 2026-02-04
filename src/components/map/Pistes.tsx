import { useMemo, memo } from 'react'
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

/** Piste difficulty configuration with colors and icons */
export const PISTE_DIFFICULTY_CONFIG: Record<Difficulty, { color: string; colorHighlight: string; icon: string; label: string }> = {
  blue: { color: '#3b82f6', colorHighlight: '#60a5fa', icon: '🔵', label: 'Easy' },
  red: { color: '#ef4444', colorHighlight: '#f87171', icon: '🔴', label: 'Intermediate' },
  black: { color: '#1e293b', colorHighlight: '#475569', icon: '⚫', label: 'Expert' },
}

/** Base line width (in pixels) */
const BASE_LINE_WIDTH = 7
/** Highlighted line width multiplier */
const HIGHLIGHT_MULTIPLIER = 2
/** Default opacity for lines */
const LINE_OPACITY = 0.9

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
    // Scale: closer = much thicker, farther = thinner
    // At distance 50, scale = 4 (very close, very thick)
    // At distance 150, scale = 2 (close, thick)
    // At distance 300 (default overview), scale = 1
    // At distance 1000, scale = 0.3 (far, thin)
    // At distance 2000, scale = 0.15 (very far, very thin)
    const newScale = Math.max(0.15, Math.min(4, 300 / distance))
    // Only update if significantly different to avoid re-renders
    if (Math.abs(newScale - scale) > 0.02) {
      setScale(newScale)
    }
  })
  
  return scale
}

/**
 * Renders all ski pistes as 3D lines that follow terrain elevation
 * Each piste may have multiple segments (coordinate arrays)
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
        <PisteLines
          key={piste.id}
          id={piste.id}
          segments={piste.coordinates}
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

interface PisteLinesProps {
  id: string
  segments: [number, number][][] // Array of segments, each segment is [lon, lat][]
  difficulty: Difficulty
  isHovered: boolean
  isSelected: boolean
  elevationGrid: ElevationGrid | null
  zoomScale: number
}

/** Height offset above terrain surface (in scene units, ~20m real) */
const PISTE_OFFSET = 2

/**
 * Renders all segments of a piste as separate Line components
 * All segments share the same hover/selection state
 */
const PisteLines = memo(function PisteLines({ segments, difficulty, isHovered, isSelected, elevationGrid, zoomScale }: PisteLinesProps) {
  const isHighlighted = isHovered || isSelected
  const baseWidth = BASE_LINE_WIDTH * zoomScale
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth
  const color = isHighlighted ? DIFFICULTY_COLORS_HIGHLIGHT[difficulty] : DIFFICULTY_COLORS[difficulty]

  return (
    <>
      {segments.map((segmentCoords, index) => (
        <PisteSegment
          key={index}
          coordinates={segmentCoords}
          color={color}
          lineWidth={lineWidth}
          opacity={isHighlighted ? 1 : LINE_OPACITY}
          elevationGrid={elevationGrid}
        />
      ))}
    </>
  )
})

interface PisteSegmentProps {
  coordinates: [number, number][]
  color: string
  lineWidth: number
  opacity: number
  elevationGrid: ElevationGrid | null
}

/**
 * Renders a single segment of a piste as a 3D line
 */
const PisteSegment = memo(function PisteSegment({ coordinates, color, lineWidth, opacity, elevationGrid }: PisteSegmentProps) {
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

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      opacity={opacity}
      transparent
      // Pointer events now handled by ProximitySelector for better UX
      raycast={() => null}
    />
  )
})
