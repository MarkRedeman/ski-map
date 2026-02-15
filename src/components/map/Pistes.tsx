import { useMemo, memo } from 'react';
import { Line } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes';
import { type Difficulty } from '@/lib/api/overpass';
import { useMapStore } from '@/stores/useMapStore';
import { coordsToLocal } from '@/lib/geo/coordinates';
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid';
import { PISTE_COLORS, DIFFICULTY_COLORS, DIFFICULTY_COLORS_HIGHLIGHT } from '@/config/theme';

/** Re-export for consumers that import from Pistes.tsx */
export const PISTE_DIFFICULTY_CONFIG = PISTE_COLORS;

/** Base line width (in pixels) */
const BASE_LINE_WIDTH = 7;
/** Highlighted line width multiplier */
const HIGHLIGHT_MULTIPLIER = 2;
/** Default opacity for lines */
const LINE_OPACITY = 1.0;
/** Dimmed opacity when another entity is active */
const DIMMED_OPACITY = 0.4;

/** Shadow outline settings for contrast against terrain */
const SHADOW_COLOR = '#000000';
const SHADOW_OPACITY = 0.4;
/** Shadow line width multiplier (relative to the main line width) */
const SHADOW_WIDTH_MULTIPLIER = 1.8;
/** Shadow Y offset below the main line (in scene units) */
const SHADOW_Y_OFFSET = -0.3;

/**
 * Hook to calculate zoom-based line width scaling
 * Returns a scale factor based on camera distance
 */
function useZoomScale(): number {
  const { camera } = useThree();
  const [scale, setScale] = useState(1);

  useFrame(() => {
    // Calculate distance from camera to origin (center of terrain)
    const distance = camera.position.length();
    // Scale: closer = much thicker, farther = thinner
    // At distance 50, scale = 4 (very close, very thick)
    // At distance 150, scale = 2 (close, thick)
    // At distance 300 (default overview), scale = 1
    // At distance 1000, scale = 0.3 (far, thin)
    // At distance 2000, scale = 0.15 (very far, very thin)
    const newScale = Math.max(0.15, Math.min(4, 300 / distance));
    // Only update if significantly different to avoid re-renders
    if (Math.abs(newScale - scale) > 0.02) {
      setScale(newScale);
    }
  });

  return scale;
}

interface PistesProps {
  enabledDifficulties: Set<Difficulty>;
}

/**
 * Renders all ski pistes as 3D lines that follow terrain elevation
 * Each piste may have multiple segments (coordinate arrays)
 */
export function Pistes({ enabledDifficulties }: PistesProps) {
  const { data: pistes, isLoading } = usePistes();
  const showPistes = useMapStore((s) => s.showPistes);
  const hoveredPisteId = useMapStore((s) => s.getHoveredId('piste'));
  const selectedPisteId = useMapStore((s) => s.getSelectedId('piste'));
  const hoveredEntity = useMapStore((s) => s.hoveredEntity);
  const selectedEntity = useMapStore((s) => s.selectedEntity);
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const zoomScale = useZoomScale();

  // Any entity (piste, lift, peak, etc.) is actively hovered or selected
  const hasActiveEntity = hoveredEntity !== null || selectedEntity !== null;

  const filteredPistes = useMemo(
    () => filterPistesByDifficulty(pistes, enabledDifficulties),
    [pistes, enabledDifficulties]
  );

  if (!showPistes || isLoading || !filteredPistes.length) {
    return null;
  }

  return (
    <group name="pistes">
      {filteredPistes.map((piste) => {
        const isHovered = hoveredPisteId === piste.id;
        const isSelected = selectedPisteId === piste.id;
        return (
          <PisteLines
            key={piste.id}
            id={piste.id}
            segments={piste.coordinates}
            difficulty={piste.difficulty}
            isHovered={isHovered}
            isSelected={isSelected}
            dimmed={hasActiveEntity && !isHovered && !isSelected}
            elevationGrid={elevationGrid}
            zoomScale={zoomScale}
          />
        );
      })}
    </group>
  );
}

interface PisteLinesProps {
  id: string;
  segments: [number, number][][]; // Array of segments, each segment is [lon, lat][]
  difficulty: Difficulty;
  isHovered: boolean;
  isSelected: boolean;
  dimmed: boolean;
  elevationGrid: ElevationGrid | null;
  zoomScale: number;
}

/** Height offset above terrain surface (in scene units, ~20m real) */
const PISTE_OFFSET = 2;

/**
 * Tolerance for matching segment endpoints (in degrees, ~1m)
 * OSM ways that share a node will have identical coordinates,
 * but we use a small tolerance for floating point safety.
 */
const STITCH_TOLERANCE = 0.000001;

/**
 * Stitch adjacent segments into continuous polylines.
 *
 * OSM frequently splits a single ski run into multiple way segments that
 * share a common node at their junction. Rendering them as separate Line2
 * meshes causes visible round endcaps to stack at shared endpoints.
 * By stitching connected segments into longer polylines, we eliminate
 * these artifacts.
 */
function stitchSegments(segments: [number, number][][]): [number, number][][] {
  if (segments.length <= 1) return segments;

  // Work with a mutable copy so we can mark segments as consumed
  const remaining = segments.map((coords, i) => ({ id: i, coords, reversed: false }));
  const result: [number, number][][] = [];

  while (remaining.length > 0) {
    // Start a new chain with the first remaining segment
    const seed = remaining.shift()!;
    const chain: [number, number][] = [...seed.coords];

    // Repeatedly try to extend the chain by finding a segment whose
    // start or end matches the chain's current start or end
    let extended = true;
    while (extended) {
      extended = false;
      const chainStart = chain[0]!;
      const chainEnd = chain[chain.length - 1]!;

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i]!;
        const segStart = seg.coords[0]!;
        const segEnd = seg.coords[seg.coords.length - 1]!;

        if (coordsMatch(chainEnd, segStart)) {
          // Append segment (skip first point — it's the shared node)
          chain.push(...seg.coords.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainEnd, segEnd)) {
          // Append reversed segment (skip last point after reversing — shared node)
          const reversed = [...seg.coords].reverse();
          chain.push(...reversed.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainStart, segEnd)) {
          // Prepend segment (skip last point — it's the shared node)
          chain.unshift(...seg.coords.slice(0, -1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainStart, segStart)) {
          // Prepend reversed segment (skip first point after reversing — shared node)
          const reversed = [...seg.coords].reverse();
          chain.unshift(...reversed.slice(0, -1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    result.push(chain);
  }

  return result;
}

function coordsMatch(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < STITCH_TOLERANCE && Math.abs(a[1] - b[1]) < STITCH_TOLERANCE;
}

/**
 * Renders all segments of a piste as Line components
 * Adjacent segments sharing endpoints are stitched into continuous polylines
 * to avoid overlapping endcap artifacts.
 */
const PisteLines = memo(function PisteLines({
  segments,
  difficulty,
  isHovered,
  isSelected,
  dimmed,
  elevationGrid,
  zoomScale,
}: PisteLinesProps) {
  const isHighlighted = isHovered || isSelected;
  const baseWidth = BASE_LINE_WIDTH * zoomScale;
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth;
  const color = isHighlighted
    ? DIFFICULTY_COLORS_HIGHLIGHT[difficulty]
    : DIFFICULTY_COLORS[difficulty];
  const opacity = isHighlighted ? 1 : dimmed ? DIMMED_OPACITY : LINE_OPACITY;

  // Stitch connected segments into continuous polylines
  const stitchedSegments = useMemo(() => stitchSegments(segments), [segments]);

  return (
    <>
      {stitchedSegments.map((segmentCoords, index) => (
        <PisteSegment
          key={index}
          coordinates={segmentCoords}
          color={color}
          lineWidth={lineWidth}
          opacity={opacity}
          elevationGrid={elevationGrid}
        />
      ))}
    </>
  );
});

interface PisteSegmentProps {
  coordinates: [number, number][];
  color: string;
  lineWidth: number;
  opacity: number;
  elevationGrid: ElevationGrid | null;
}

/**
 * Renders a single segment of a piste as a 3D line with a shadow outline
 */
const PisteSegment = memo(function PisteSegment({
  coordinates,
  color,
  lineWidth,
  opacity,
  elevationGrid,
}: PisteSegmentProps) {
  // Convert geo coordinates to local 3D coordinates with terrain elevation
  const { points, shadowPoints } = useMemo(() => {
    const main: [number, number, number][] = [];
    const shadow: [number, number, number][] = [];

    coordinates.forEach(([lon, lat]) => {
      const result = coordsToLocal([[lon, lat]], 0);
      const [x, , z] = result[0] ?? [0, 0, 0];

      // Sample terrain elevation if available, otherwise use flat Y=2
      let y = PISTE_OFFSET;
      if (elevationGrid) {
        const terrainY = sampleElevation(elevationGrid, x, z);
        y = terrainY + PISTE_OFFSET;
      }

      main.push([x, y, z]);
      shadow.push([x, y + SHADOW_Y_OFFSET, z]);
    });

    return { points: main, shadowPoints: shadow };
  }, [coordinates, elevationGrid]);

  if (points.length < 2) return null;

  const shadowWidth = lineWidth * SHADOW_WIDTH_MULTIPLIER;

  return (
    <>
      {/* Shadow outline — wider dark line underneath for terrain contrast */}
      <Line
        points={shadowPoints}
        color={SHADOW_COLOR}
        lineWidth={shadowWidth}
        opacity={opacity > 0 ? Math.min(opacity, SHADOW_OPACITY) : 0}
        transparent
        raycast={() => null}
      />
      {/* Main colored line */}
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        opacity={opacity}
        transparent
        raycast={() => null}
      />
    </>
  );
});
