import { useMemo, memo } from 'react';
import { Line } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { usePistes, filterPistesByDifficulty } from '@/hooks/usePistes';
import { type Difficulty } from '@/lib/api/overpass';
import { useMapStore } from '@/stores/useMapStore';
import { coordsToLocal } from '@/lib/geo/coordinates';
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid';
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_COLORS_HIGHLIGHT,
  LINE_STYLE,
} from '@/config/theme';

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

  if (isLoading || !filteredPistes.length) {
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

interface StitchResult {
  /** Stitched polylines (connected segments merged) */
  polylines: [number, number][][];
}

/**
 * Stitch adjacent segments into continuous polylines.
 *
 * OSM frequently splits a single ski run into multiple way segments that
 * share a common node at their junction. Rendering them as separate Line2
 * meshes causes visible round endcaps to stack at shared endpoints.
 * By stitching connected segments into longer polylines, we eliminate
 * most of these artifacts.
 */
function stitchSegments(segments: [number, number][][]): StitchResult {
  if (segments.length <= 1) return { polylines: segments };

  // Work with a mutable copy so we can mark segments as consumed
  const remaining = segments.map((coords) => ({ coords }));
  const polylines: [number, number][][] = [];

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
          chain.push(...seg.coords.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainEnd, segEnd)) {
          const reversed = [...seg.coords].reverse();
          chain.push(...reversed.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainStart, segEnd)) {
          chain.unshift(...seg.coords.slice(0, -1));
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (coordsMatch(chainStart, segStart)) {
          const reversed = [...seg.coords].reverse();
          chain.unshift(...reversed.slice(0, -1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    polylines.push(chain);
  }

  return { polylines };
}

function coordsMatch(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < STITCH_TOLERANCE && Math.abs(a[1] - b[1]) < STITCH_TOLERANCE;
}

/**
 * Renders all segments of a piste as Line components.
 * Adjacent segments sharing endpoints are stitched into continuous polylines
 * to avoid overlapping endcap artifacts. Shadow and main lines are rendered
 * in separate groups to prevent shadow endcap alpha-blending at junctions.
 */
const PisteLines = memo(function PisteLines({
  segments,
  difficulty,
  isHovered,
  isSelected,
  dimmed: _dimmed,
  elevationGrid,
  zoomScale,
}: PisteLinesProps) {
  const isHighlighted = isHovered || isSelected;
  const baseWidth = LINE_STYLE.baseWidth * zoomScale;
  const lineWidth = isHighlighted ? baseWidth * LINE_STYLE.highlightWidthMultiplier : baseWidth;
  const color = isHighlighted
    ? DIFFICULTY_COLORS_HIGHLIGHT[difficulty]
    : DIFFICULTY_COLORS[difficulty];
  const opacity = isHighlighted ? 1 : LINE_STYLE.opacity;

  // Stitch connected segments into continuous polylines
  const { polylines } = useMemo(() => stitchSegments(segments), [segments]);

  const shadowWidth = lineWidth * LINE_STYLE.shadowWidthMultiplier;
  const shadowOpacity = opacity > 0 ? Math.min(opacity, LINE_STYLE.shadowOpacity) : 0;

  return (
    <>
      {polylines.map((segmentCoords, index) => (
        <PisteSegment
          key={index}
          coordinates={segmentCoords}
          color={color}
          lineWidth={lineWidth}
          opacity={opacity}
          shadowWidth={shadowWidth}
          shadowOpacity={shadowOpacity}
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
  shadowWidth: number;
  shadowOpacity: number;
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
  shadowWidth,
  shadowOpacity,
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
      shadow.push([x, y + LINE_STYLE.shadowYOffset, z]);
    });

    return { points: main, shadowPoints: shadow };
  }, [coordinates, elevationGrid]);

  if (points.length < 2) return null;

  return (
    <>
      {/* Shadow outline — wider dark line underneath for terrain contrast */}
      <Line
        points={shadowPoints}
        color={LINE_STYLE.shadowColor}
        lineWidth={shadowWidth}
        opacity={shadowOpacity}
        transparent
        depthWrite={false}
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
