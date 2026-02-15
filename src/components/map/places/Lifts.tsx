import { useMemo, memo } from 'react';
import { Line } from '@react-three/drei';
import { useLifts } from '@/hooks/useLifts';
import { useMapStore, type LiftType } from '@/stores/useMapStore';
import { coordsToLocal } from '@/lib/geo/coordinates';
import { sampleElevation, type ElevationGrid } from '@/lib/geo/elevationGrid';
import { LIFT_COLORS, LINE_STYLE } from '@/config/theme';
import { useZoomScale } from '@/hooks/useZoomScale';

/** Height offset above terrain for lift cables (in scene units, ~100m real) */
const LIFT_CABLE_OFFSET = 10;
/** Height offset above terrain for station buildings */
const LIFT_STATION_OFFSET = 3;

/**
 * Get the config for a lift type, with fallback to default
 */
function getLiftConfig(type: string): { color: string; colorHighlight: string; icon: string } {
  return LIFT_COLORS[type as LiftType] ?? LIFT_COLORS['Lift'];
}

/**
 * Renders all ski lifts as 3D lines that follow terrain elevation
 */
export function Lifts() {
  const { data: lifts, isLoading } = useLifts();
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const hoveredLiftId = useMapStore((s) => s.getHoveredId('lift'));
  const selectedLiftId = useMapStore((s) => s.getSelectedId('lift'));
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const zoomScale = useZoomScale();

  // Filter lifts by visible types
  const visibleLifts = useMemo(() => {
    if (!lifts) return [];
    return lifts.filter((lift) => visibleLiftTypes.has(lift.type as LiftType));
  }, [lifts, visibleLiftTypes]);

  if (isLoading || !visibleLifts.length) {
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
  elevationGrid: ElevationGrid | null;
  zoomScale: number;
}

const LiftLine = memo(function LiftLine({
  type,
  coordinates,
  isHovered,
  isSelected,
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
      cableShadow.push([x, cableY + LINE_STYLE.shadowYOffset, z]);

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
  const baseWidth = LINE_STYLE.baseWidth * zoomScale;
  const lineWidth = isHighlighted ? baseWidth * LINE_STYLE.highlightWidthMultiplier : baseWidth;
  const opacity = isHighlighted ? 1 : LINE_STYLE.opacity;

  // Get station geometry based on lift type
  const stationGeometry = getStationGeometry(type);
  const shadowWidth = lineWidth * LINE_STYLE.shadowWidthMultiplier;

  return (
    <group>
      {/* Shadow outline — wider dark line underneath for terrain contrast */}
      <Line
        points={cableShadowPoints}
        color={LINE_STYLE.shadowColor}
        lineWidth={shadowWidth}
        opacity={opacity > 0 ? Math.min(opacity, LINE_STYLE.shadowOpacity) : 0}
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
