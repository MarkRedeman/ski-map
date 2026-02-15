/**
 * PlaceLabels component - renders village/town labels with smart visibility
 *
 * Features:
 * - Badge-style labels with building icon
 * - Smart distance-based filtering: towns always visible, villages/hamlets filtered by proximity to lifts
 * - Uses terrain elevation sampling for accurate Y positioning
 */

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { usePlaces } from '@/hooks/usePlaces';
import { useLifts } from '@/hooks/useLifts';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';

type PlaceType = 'town' | 'village' | 'hamlet';

/** Only show villages/hamlets within this distance (meters) of a lift */
const PLACE_PROXIMITY_RADIUS = 1000;

/**
 * Calculate approximate distance between two geo points in meters
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const latDiff = (lat2 - lat1) * 111000; // ~111km per degree latitude
  const lonDiff = (lon2 - lon1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

/**
 * Get which place types to show based on zoom distance
 *
 * Uses distance from camera to orbit target, which is stable during
 * rotation and only changes on actual zoom in/out.
 */
function getVisiblePlaceTypes(zoomDistance: number): Set<PlaceType> {
  if (zoomDistance < 500) {
    return new Set(['town', 'village', 'hamlet']); // Show all
  }
  if (zoomDistance < 1500) {
    return new Set(['town', 'village']); // Towns and villages
  }
  return new Set(['town']); // Only towns when far away
}

/**
 * Quantize zoom distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(zoomDistance: number): number {
  if (zoomDistance < 500) return 0;
  if (zoomDistance < 1500) return 1;
  return 2;
}

/**
 * Get icon based on place type
 */
function getPlaceIcon(type: PlaceType): string {
  switch (type) {
    case 'town':
      return '🏘️';
    case 'village':
      return '🏠';
    case 'hamlet':
      return '🏡';
  }
}

interface PlaceLabelProps {
  name: string;
  type: PlaceType;
  position: [number, number, number];
  isSelected: boolean;
}

function PlaceLabel({ name, type, position, isSelected }: PlaceLabelProps) {
  const isTown = type === 'town';

  return (
    <Html position={position} center distanceFactor={isTown ? 250 : 200} zIndexRange={[40, 0]}>
      <div
        className={`
        pointer-events-none flex items-center gap-2 rounded-full backdrop-blur-sm shadow-lg
        ${isSelected ? (isTown ? 'bg-orange-900/90 ring-2 ring-orange-400/60 px-4 py-2' : 'bg-orange-900/90 ring-2 ring-orange-400/60 px-3 py-1.5') : isTown ? 'bg-amber-900/80 px-4 py-2' : 'bg-black/70 px-3 py-1.5'}
      `}
      >
        <span className={isTown ? 'text-lg' : 'text-base'}>{getPlaceIcon(type)}</span>
        <span
          className={`
          font-semibold text-white whitespace-nowrap
          ${isTown ? 'text-base' : 'text-sm'}
        `}
        >
          {name}
        </span>
      </div>
    </Html>
  );
}

export function PlaceLabels() {
  const { data: places } = usePlaces();
  const { data: lifts } = useLifts();
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const showPlaces = useMapStore((s) => s.showPlaces);
  const selectedPlaceId = useMapStore((s) => s.getSelectedId('place'));

  // Track zoom level for filtering
  const [distanceLevel, setDistanceLevel] = useState(1);

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

  // Get all lift coordinates for proximity filtering
  const liftPoints = useMemo(() => {
    if (!lifts) return [];
    return lifts.flatMap((lift) => lift.coordinates.map(([lon, lat]) => ({ lat, lon })));
  }, [lifts]);

  // Filter and position places based on camera distance and lift proximity
  // Always include the selected place regardless of zoom/filters
  const visiblePlaces = useMemo(() => {
    if (!places || !showPlaces) return [];

    const visibleTypes = getVisiblePlaceTypes(
      distanceLevel === 0 ? 0 : distanceLevel === 1 ? 1000 : 2000
    );

    return (
      places
        // Keep selected place, otherwise filter by type visibility
        .filter(
          (place) => place.id === selectedPlaceId || visibleTypes.has(place.type as PlaceType)
        )
        // Towns are always visible; villages/hamlets only if near lifts (or selected)
        .filter((place) => {
          if (place.id === selectedPlaceId) return true;
          if (place.type === 'town') return true;
          if (liftPoints.length === 0) return true;
          return liftPoints.some(
            (point) =>
              geoDistance(place.lat, place.lon, point.lat, point.lon) < PLACE_PROXIMITY_RADIUS
          );
        })
        .map((place) => {
          // Convert geo coordinates to local 3D position
          const [x, , z] = geoToLocal(place.lat, place.lon, 0);

          // Get terrain height at this position
          let y: number;
          if (elevationGrid) {
            y = sampleElevation(elevationGrid, x, z) + 20; // Offset above terrain
          } else {
            y = 20; // Default height if no elevation data
          }

          return {
            ...place,
            position: [x, y, z] as [number, number, number],
          };
        })
    );
  }, [places, liftPoints, elevationGrid, showPlaces, distanceLevel, selectedPlaceId]);

  if (!showPlaces || visiblePlaces.length === 0) return null;

  return (
    <group name="place-labels">
      {visiblePlaces.map((place) => (
        <PlaceLabel
          key={place.id}
          name={place.name}
          type={place.type as PlaceType}
          position={place.position}
          isSelected={selectedPlaceId === place.id}
        />
      ))}
    </group>
  );
}
