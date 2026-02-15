/**
 * RunPath component renders a ski run as a 3D path on the terrain
 * Color-coded by segment type: skiing (piste difficulty), lift (lift type), idle (gray)
 */

import { useMemo } from 'react';
import { Line, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SkiRun } from '@/lib/garmin/types';
import { geoToLocal, SOLDEN_CENTER } from '@/lib/geo/coordinates';
import { useMapStore } from '@/stores/useMapStore';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import { useRideSegments } from '@/hooks/useRideSegments';
import { getSegmentColor } from '@/lib/garmin/pisteMatch';
import type { RideSegment } from '@/lib/garmin/segments';

interface RunPathProps {
  run: SkiRun;
  showMarkers?: boolean;
}

// Colors for start/end markers
const COLOR_START = new THREE.Color('#22c55e'); // Green
const COLOR_END = new THREE.Color('#ef4444'); // Red

/** Height offset above terrain so path renders above pistes */
const PATH_HEIGHT_OFFSET = 5;

/** Line width configuration */
const LINE_WIDTH_SKIING = 4;
const LINE_WIDTH_LIFT = 3;
const LINE_WIDTH_IDLE = 2;

export function RunPath({ run, showMarkers = true }: RunPathProps) {
  const { coordinates } = run;
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const rideSegments = useRideSegments(run);

  if (coordinates.length < 2) {
    return null;
  }

  // Convert all coordinates to 3D points, projected onto terrain
  const allPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];

    for (const coord of coordinates) {
      const [x, , z] = geoToLocal(coord.lat, coord.lon, 0);
      // Sample terrain elevation, fall back to GPS elevation if grid not loaded
      const terrainY = elevationGrid
        ? sampleElevation(elevationGrid, x, z)
        : (coord.elevation - SOLDEN_CENTER.elevation) * 0.015;
      // Add height offset so path renders above pistes
      points.push(new THREE.Vector3(x, terrainY + PATH_HEIGHT_OFFSET, z));
    }

    return points;
  }, [coordinates, elevationGrid]);

  // Create renderable segment data
  const segmentLines = useMemo(() => {
    if (rideSegments.length === 0 || allPoints.length === 0) {
      return [];
    }

    return rideSegments
      .map((segment) => {
        // Extract points for this segment
        const segmentPoints: THREE.Vector3[] = [];
        for (let i = segment.startIndex; i <= segment.endIndex && i < allPoints.length; i++) {
          const point = allPoints[i];
          if (point) {
            segmentPoints.push(point);
          }
        }

        return {
          segment,
          points: segmentPoints,
          color: getSegmentColor(segment),
        };
      })
      .filter((s) => s.points.length >= 2);
  }, [rideSegments, allPoints]);

  // Start and end positions
  const startPos = allPoints[0];
  const endPos = allPoints[allPoints.length - 1];

  // Don't render if we don't have valid positions
  if (!startPos || !endPos) {
    return null;
  }

  return (
    <group name="run-path">
      {/* Render each segment with appropriate styling */}
      {segmentLines.map((segLine, i) => (
        <SegmentLine
          key={i}
          segment={segLine.segment}
          points={segLine.points}
          color={segLine.color}
        />
      ))}

      {/* Fallback: if no segments yet, render simple line */}
      {segmentLines.length === 0 && allPoints.length >= 2 && (
        <Line points={allPoints} color="#6b7280" lineWidth={3} opacity={0.9} transparent />
      )}

      {/* Start marker */}
      {showMarkers && (
        <group position={startPos}>
          <Sphere args={[4, 16, 16]}>
            <meshStandardMaterial
              color={COLOR_START}
              emissive={COLOR_START}
              emissiveIntensity={0.3}
            />
          </Sphere>
          <Html position={[0, 10, 0]} center distanceFactor={200} occlude>
            <div className="whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs font-medium text-white shadow-lg">
              Start
            </div>
          </Html>
        </group>
      )}

      {/* End marker */}
      {showMarkers && (
        <group position={endPos}>
          <Sphere args={[4, 16, 16]}>
            <meshStandardMaterial color={COLOR_END} emissive={COLOR_END} emissiveIntensity={0.3} />
          </Sphere>
          <Html position={[0, 10, 0]} center distanceFactor={200} occlude>
            <div className="whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-lg">
              Finish
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

interface SegmentLineProps {
  segment: RideSegment;
  points: THREE.Vector3[];
  color: string;
}

/**
 * Render a single segment with appropriate styling
 */
function SegmentLine({ segment, points, color }: SegmentLineProps) {
  if (points.length < 2) return null;

  const lineWidth =
    segment.type === 'skiing'
      ? LINE_WIDTH_SKIING
      : segment.type === 'lift'
        ? LINE_WIDTH_LIFT
        : LINE_WIDTH_IDLE;

  // Lift segments get dashed lines
  if (segment.type === 'lift') {
    return (
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        opacity={0.9}
        transparent
        dashed
        dashSize={3}
        gapSize={2}
      />
    );
  }

  // Idle segments get thin solid lines
  if (segment.type === 'idle') {
    return <Line points={points} color={color} lineWidth={lineWidth} opacity={0.6} transparent />;
  }

  // Skiing segments get solid lines
  return <Line points={points} color={color} lineWidth={lineWidth} opacity={0.9} transparent />;
}
