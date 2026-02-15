import { useMemo, useState, memo } from 'react';
import { Line } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useLifts } from '@/hooks/useLifts';
import { useMapStore, type LiftType } from '@/stores/useMapStore';
import { coordsToLocal } from '@/lib/geo/coordinates';
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid';
import { LIFT_COLORS } from '@/config/theme';

/** Re-export for consumers that import from Lifts.tsx */
export const LIFT_TYPE_CONFIG = LIFT_COLORS;

/** Height offset above terrain for lift cables (in scene units, ~100m real) */
const LIFT_CABLE_OFFSET = 10;
/** Height offset above terrain for station buildings */
const LIFT_STATION_OFFSET = 3;

/** Base line width for lifts (in pixels) */
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
    const distance = camera.position.length();
    // Scale: closer = much thicker, farther = thinner
    // At distance 50, scale = 4 (very close, very thick)
    // At distance 150, scale = 2 (close, thick)
    // At distance 300 (default overview), scale = 1
    // At distance 1000, scale = 0.3 (far, thin)
    // At distance 2000, scale = 0.15 (very far, very thin)
    const newScale = Math.max(0.15, Math.min(4, 300 / distance));
    if (Math.abs(newScale - scale) > 0.02) {
      setScale(newScale);
    }
  });

  return scale;
}

/**
 * Get the config for a lift type, with fallback to default
 */
function getLiftConfig(type: string): { color: string; colorHighlight: string; icon: string } {
  return LIFT_TYPE_CONFIG[type as LiftType] ?? LIFT_TYPE_CONFIG['Lift'];
}

/**
 * Renders all ski lifts as 3D lines that follow terrain elevation
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts();
  const showLifts = useMapStore((s) => s.showLifts);
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const hoveredLiftId = useMapStore((s) => s.getHoveredId('lift'));
  const selectedLiftId = useMapStore((s) => s.getSelectedId('lift'));
  const hoveredEntity = useMapStore((s) => s.hoveredEntity);
  const selectedEntity = useMapStore((s) => s.selectedEntity);
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const zoomScale = useZoomScale();

  // Any entity (piste, lift, peak, etc.) is actively hovered or selected
  const hasActiveEntity = hoveredEntity !== null || selectedEntity !== null;

  // Filter lifts by visible types
  const visibleLifts = useMemo(() => {
    if (!lifts) return [];
    return lifts.filter((lift) => visibleLiftTypes.has(lift.type as LiftType));
  }, [lifts, visibleLiftTypes]);

  if (!showLifts || isLoading || !visibleLifts.length) {
    return null;
  }

  return (
    <group name="lifts">
      {visibleLifts.map((lift) => {
        const isHovered = hoveredLiftId === lift.id;
        const isSelected = selectedLiftId === lift.id;
        return (
          <LiftLine
            key={lift.id}
            id={lift.id}
            type={lift.type}
            coordinates={lift.coordinates}
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

interface LiftLineProps {
  id: string;
  type: string;
  coordinates: [number, number][];
  isHovered: boolean;
  isSelected: boolean;
  dimmed: boolean;
  elevationGrid: ElevationGrid | null;
  zoomScale: number;
}

const LiftLine = memo(function LiftLine({
  type,
  coordinates,
  isHovered,
  isSelected,
  dimmed,
  elevationGrid,
  zoomScale,
}: LiftLineProps) {
  const config = getLiftConfig(type);

  // Convert geo coordinates to local 3D coordinates with terrain elevation
  // Lifts are elevated above terrain to simulate cable height
  const { cablePoints, cableShadowPoints, stationPoints } = useMemo(() => {
    const cable: [number, number, number][] = [];
    const cableShadow: [number, number, number][] = [];
    const stations: [number, number, number][] = [];

    coordinates.forEach(([lon, lat], index) => {
      const result = coordsToLocal([[lon, lat]], 0);
      const [x, , z] = result[0] ?? [0, 0, 0];

      // Sample terrain elevation if available
      let terrainY = 0;
      if (elevationGrid) {
        terrainY = sampleElevation(elevationGrid, x, z);
      }

      // Cable points are high above terrain
      const cableY = terrainY + LIFT_CABLE_OFFSET;
      cable.push([x, cableY, z]);
      cableShadow.push([x, cableY + SHADOW_Y_OFFSET, z]);

      // Station points only at start and end
      if (index === 0 || index === coordinates.length - 1) {
        stations.push([x, terrainY + LIFT_STATION_OFFSET, z]);
      }
    });

    return { cablePoints: cable, cableShadowPoints: cableShadow, stationPoints: stations };
  }, [coordinates, elevationGrid]);

  if (cablePoints.length < 2) return null;

  const isHighlighted = isHovered || isSelected;
  const color = isHighlighted ? config.colorHighlight : config.color;
  const baseWidth = BASE_LINE_WIDTH * zoomScale;
  const lineWidth = isHighlighted ? baseWidth * HIGHLIGHT_MULTIPLIER : baseWidth;
  const opacity = isHighlighted ? 1 : dimmed ? DIMMED_OPACITY : LINE_OPACITY;

  // Get station geometry based on lift type
  const stationGeometry = getStationGeometry(type);
  const shadowWidth = lineWidth * SHADOW_WIDTH_MULTIPLIER;

  return (
    <group>
      {/* Shadow outline — wider dark line underneath for terrain contrast */}
      <Line
        points={cableShadowPoints}
        color={SHADOW_COLOR}
        lineWidth={shadowWidth}
        opacity={opacity > 0 ? Math.min(opacity, SHADOW_OPACITY) : 0}
        transparent
        depthWrite={false}
        dashed
        dashSize={2}
        gapSize={1}
        raycast={() => null}
      />
      {/* Lift cable line */}
      <Line
        points={cablePoints}
        color={color}
        lineWidth={lineWidth}
        opacity={opacity}
        transparent
        dashed
        dashSize={2}
        gapSize={1}
        // Pointer events now handled by ProximitySelector for better UX
        raycast={() => null}
      />

      {/* Station markers at start and end */}
      {stationPoints[0] && (
        <mesh position={stationPoints[0]} raycast={() => null}>
          {stationGeometry}
          <meshStandardMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {stationPoints[1] && (
        <mesh position={stationPoints[1]} raycast={() => null}>
          {stationGeometry}
          <meshStandardMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
    </group>
  );
});

/**
 * Returns the appropriate station geometry based on lift type
 */
function getStationGeometry(liftType: string): JSX.Element {
  switch (liftType) {
    case 'Gondola':
    case 'Cable Car':
      // Large building for major lifts
      return <boxGeometry args={[4, 8, 4]} />;
    case 'Chair Lift':
      // Medium building
      return <boxGeometry args={[3, 6, 3]} />;
    case 'T-Bar':
    case 'Button Lift':
    case 'Drag Lift':
      // Small pole for drag lifts
      return <cylinderGeometry args={[0.5, 0.5, 5, 8]} />;
    case 'Magic Carpet':
      // Flat platform
      return <boxGeometry args={[6, 1, 3]} />;
    default:
      return <boxGeometry args={[3, 6, 3]} />;
  }
}
