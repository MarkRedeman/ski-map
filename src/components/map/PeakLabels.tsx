/**
 * PeakLabels component - renders mountain peak labels with smart visibility
 *
 * Features:
 * - Badge-style labels with mountain icon and elevation
 * - Only shows peaks near ski lifts (within proximity radius)
 * - Smart distance-based filtering: shows more peaks when zoomed in
 * - Uses terrain elevation sampling for accurate Y positioning
 */

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { usePeaks } from '@/hooks/usePeaks';
import { useLifts } from '@/hooks/useLifts';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import { getRegionCenter } from '@/stores/useAppConfigStore';
import { sampleElevation } from '@/lib/geo/elevationGrid';

const SCALE = 0.1; // Same scale factor as coordinates.ts

/** Only show peaks within this distance (meters) of a lift */
const PEAK_PROXIMITY_RADIUS = 500;

/**
 * Calculate approximate distance between two geo points in meters
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const latDiff = (lat2 - lat1) * 111000; // ~111km per degree latitude
  const lonDiff = (lon2 - lon1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

/**
 * Get minimum elevation threshold based on zoom distance
 * Closer zoom = show more peaks, farther zoom = show only highest peaks
 *
 * Uses distance from camera to orbit target, which is stable during
 * rotation and only changes on actual zoom in/out.
 */
function getMinElevation(zoomDistance: number): number {
  if (zoomDistance < 400) return 0; // Close: all nearby peaks
  if (zoomDistance < 1000) return 2600; // Medium: higher peaks
  return 2900; // Far: only major peaks
}

/**
 * Quantize zoom distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(zoomDistance: number): number {
  if (zoomDistance < 400) return 0;
  if (zoomDistance < 1000) return 1;
  return 2;
}

interface PeakLabelProps {
  name: string;
  elevation: number;
  position: [number, number, number];
  isSelected: boolean;
}

function PeakLabel({ name, elevation, position, isSelected }: PeakLabelProps) {
  return (
    <Html position={position} center distanceFactor={200} zIndexRange={[50, 0]}>
      <div
        className={`
          pointer-events-none flex items-center gap-2 rounded-full backdrop-blur-sm shadow-lg px-3 py-1.5
          ${isSelected ? 'bg-purple-900/90 ring-2 ring-purple-400/60' : 'bg-black/70'}
        `}
      >
        <span className="text-base">⛰️</span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white whitespace-nowrap">{name}</span>
          <span className="text-xs text-white/70">{elevation.toLocaleString()}m</span>
        </div>
      </div>
    </Html>
  );
}

export function PeakLabels() {
  const { data: peaks } = usePeaks();
  const { data: lifts } = useLifts();
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const showLabels = useMapStore((s) => s.showLabels);
  const selectedPeakId = useMapStore((s) => s.getSelectedId('peak'));

  // Track zoom level for filtering (quantized to avoid constant re-renders)
  const [distanceLevel, setDistanceLevel] = useState(2);

  // Update distance level based on zoom distance (camera-to-orbit-target distance)
  // This is stable during rotation and only changes on actual zoom in/out
  useFrame(({ camera, controls }) => {
    const orbitControls = controls as { target?: { distanceTo: (v: any) => number } } | null;
    const zoomDistance = orbitControls?.target
      ? camera.position.distanceTo(orbitControls.target as any)
      : camera.position.length();
    const newLevel = getDistanceLevel(zoomDistance);
    if (newLevel !== distanceLevel) {
      setDistanceLevel(newLevel);
    }
  });

  // Get all lift coordinates (all points along lift lines, not just stations)
  const liftPoints = useMemo(() => {
    if (!lifts) return [];
    return lifts.flatMap((lift) => lift.coordinates.map(([lon, lat]) => ({ lat, lon })));
  }, [lifts]);

  // Filter peaks to only those near lifts, then by elevation
  // Always include the selected peak regardless of zoom/filters
  const visiblePeaks = useMemo(() => {
    if (!peaks || !showLabels || liftPoints.length === 0) return [];

    const minElevation = getMinElevation(
      distanceLevel === 0 ? 0 : distanceLevel === 1 ? 700 : 1500
    );

    // Peaks near lifts (proximity filter applies to all)
    const nearbyPeaks = peaks.filter((peak) =>
      liftPoints.some(
        (point) => geoDistance(peak.lat, peak.lon, point.lat, point.lon) < PEAK_PROXIMITY_RADIUS
      )
    );

    // Apply elevation filter, but always keep the selected peak
    const filtered = nearbyPeaks.filter(
      (peak): peak is typeof peak & { elevation: number } =>
        peak.id === selectedPeakId || (peak.elevation != null && peak.elevation >= minElevation)
    );

    return filtered.map((peak) => {
      // Convert geo coordinates to local 3D position
      const [x, , z] = geoToLocal(peak.lat, peak.lon, 0);

      // Get terrain height at this position, or use peak elevation
      let y: number;
      if (elevationGrid) {
        const terrainY = sampleElevation(elevationGrid, x, z);
        // Use the higher of terrain height or OSM elevation (in case terrain data is lower res)
        const peakY = (peak.elevation - getRegionCenter().elevation) * SCALE;
        y = Math.max(terrainY, peakY) + 15; // Offset above terrain
      } else {
        y = (peak.elevation - getRegionCenter().elevation) * SCALE + 15;
      }

      return {
        ...peak,
        position: [x, y, z] as [number, number, number],
      };
    });
  }, [peaks, liftPoints, elevationGrid, showLabels, distanceLevel, selectedPeakId]);

  if (!showLabels || visiblePeaks.length === 0) return null;

  return (
    <group name="peak-labels">
      {visiblePeaks.map((peak) => (
        <PeakLabel
          key={peak.id}
          name={peak.name}
          elevation={peak.elevation}
          position={peak.position}
          isSelected={selectedPeakId === peak.id}
        />
      ))}
    </group>
  );
}
