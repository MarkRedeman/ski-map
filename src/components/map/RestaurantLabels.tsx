/**
 * RestaurantLabels component - renders restaurant/cafe/bar/hut pin markers
 *
 * Features:
 * - Pin-style markers (not text labels) for compact on-map presence
 * - Sub-type-specific icons (fork-and-knife, coffee, wine, cabin)
 * - Only shows restaurants near ski lifts or pistes (within ~1000m proximity radius)
 * - Smart distance-based filtering: shows more when zoomed in
 * - Uses terrain elevation sampling for accurate Y positioning
 * - Clickable pins for selection with hover highlight
 */

import { useMemo, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useLifts } from '@/hooks/useLifts';
import { usePistes } from '@/hooks/usePistes';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import type { RestaurantType, Restaurant } from '@/lib/api/overpass';

/** Only show restaurants within this distance (meters) of a lift or piste */
const RESTAURANT_PROXIMITY_RADIUS = 1000;

/** Camera distance for focusing on a restaurant */
const RESTAURANT_FOCUS_DISTANCE = 500;

/**
 * Calculate approximate distance between two geo points in meters
 */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const latDiff = (lat2 - lat1) * 111000; // ~111km per degree latitude
  const lonDiff = (lon2 - lon1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

/**
 * Get max number of restaurants to show based on zoom distance level
 *
 * Uses distance from camera to orbit target, which is stable during
 * rotation and only changes on actual zoom in/out.
 */
function getMaxRestaurants(zoomDistance: number): number {
  if (zoomDistance < 600) return Infinity; // Close: show all nearby
  if (zoomDistance < 1500) return 50; // Medium: generous limit
  return 30; // Far: still show a good number
}

/**
 * Quantize zoom distance to threshold levels to avoid constant re-renders
 */
function getDistanceLevel(zoomDistance: number): number {
  if (zoomDistance < 600) return 0;
  if (zoomDistance < 1500) return 1;
  return 2;
}

/** Icon for each restaurant sub-type */
const RESTAURANT_TYPE_ICONS: Record<RestaurantType, string> = {
  Restaurant: '🍽️',
  Cafe: '☕',
  Bar: '🍷',
  'Alpine Hut': '🏔️',
};

interface RestaurantPinProps {
  restaurant: Restaurant;
  position: [number, number, number];
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onSelect: () => void;
}

function RestaurantPin({
  restaurant,
  position,
  isHovered,
  isSelected,
  onHover,
  onSelect,
}: RestaurantPinProps) {
  const icon = RESTAURANT_TYPE_ICONS[restaurant.type] ?? '🍽️';
  const expanded = isHovered || isSelected;

  return (
    <Html position={position} center distanceFactor={200} zIndexRange={[30, 0]}>
      <button
        onClick={onSelect}
        onMouseEnter={() => onHover(restaurant.id)}
        onMouseLeave={() => onHover(null)}
        className={`
          flex items-center gap-1.5 rounded-full backdrop-blur-sm shadow-lg cursor-pointer
          transition-all duration-150 border-none outline-none
          ${isSelected ? 'bg-emerald-800/90 ring-2 ring-emerald-400/60 px-3.5 py-2' : isHovered ? 'bg-black/80 px-3.5 py-2' : 'bg-black/60 px-2.5 py-1.5'}
        `}
      >
        <span className={expanded ? 'text-lg' : 'text-base'}>{icon}</span>
        {expanded && (
          <span className="text-sm font-medium text-white whitespace-nowrap">
            {restaurant.name}
          </span>
        )}
      </button>
    </Html>
  );
}

export function RestaurantLabels() {
  const { data: restaurants } = useRestaurants();
  const { data: lifts } = useLifts();
  const { data: pistes } = usePistes();
  const elevationGrid = useMapStore((s) => s.elevationGrid);
  const visibleRestaurantTypes = useMapStore((s) => s.visibleRestaurantTypes);
  const hoveredRestaurantId = useMapStore((s) => s.getHoveredId('restaurant'));
  const selectedRestaurantId = useMapStore((s) => s.getSelectedId('restaurant'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);

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

  // Get all lift and piste coordinates for proximity filtering
  const infrastructurePoints = useMemo(() => {
    const points: { lat: number; lon: number }[] = [];

    // Lift coordinates
    if (lifts) {
      for (const lift of lifts) {
        for (const [lon, lat] of lift.coordinates) {
          points.push({ lat, lon });
        }
      }
    }

    // Piste coordinates (all segments)
    if (pistes) {
      for (const piste of pistes) {
        for (const segment of piste.coordinates) {
          for (const [lon, lat] of segment) {
            points.push({ lat, lon });
          }
        }
      }
    }

    return points;
  }, [lifts, pistes]);

  // Filter and position restaurants based on proximity to lifts/pistes
  // Always include the selected restaurant regardless of zoom/filters
  const visibleRestaurants = useMemo(() => {
    if (!restaurants || visibleRestaurantTypes.size === 0 || infrastructurePoints.length === 0)
      return [];

    const maxCount = getMaxRestaurants(distanceLevel === 0 ? 0 : distanceLevel === 1 ? 1000 : 2000);

    const filtered = restaurants
      // Only show restaurants whose type is visible (but always keep the selected one)
      .filter(
        (restaurant) =>
          restaurant.id === selectedRestaurantId || visibleRestaurantTypes.has(restaurant.type)
      )
      // Only show restaurants near lifts or pistes (but always keep the selected one)
      .filter(
        (restaurant) =>
          restaurant.id === selectedRestaurantId ||
          infrastructurePoints.some(
            (point) =>
              geoDistance(restaurant.lat, restaurant.lon, point.lat, point.lon) <
              RESTAURANT_PROXIMITY_RADIUS
          )
      )
      // Prioritize: Alpine Huts first (on-mountain), then restaurants, cafes, bars
      .sort((a, b) => {
        // Selected restaurant always comes first so it survives the slice
        if (a.id === selectedRestaurantId) return -1;
        if (b.id === selectedRestaurantId) return 1;
        const typeOrder: Record<string, number> = {
          'Alpine Hut': 0,
          Restaurant: 1,
          Cafe: 2,
          Bar: 3,
        };
        return (typeOrder[a.type] ?? 4) - (typeOrder[b.type] ?? 4);
      })
      .slice(0, maxCount);

    return filtered.map((restaurant) => {
      // Convert geo coordinates to local 3D position
      const [x, , z] = geoToLocal(restaurant.lat, restaurant.lon, 0);

      // Get terrain height at this position
      let y: number;
      if (elevationGrid) {
        y = sampleElevation(elevationGrid, x, z) + 15; // Offset above terrain
      } else {
        y = 15; // Default height if no elevation data
      }

      return {
        ...restaurant,
        position: [x, y, z] as [number, number, number],
      };
    });
  }, [
    restaurants,
    infrastructurePoints,
    elevationGrid,
    visibleRestaurantTypes,
    distanceLevel,
    selectedRestaurantId,
  ]);

  // Handle selection and camera focus when clicking a pin
  // Uses terrain sampling for accurate centering on mountainous terrain
  const handleSelect = useCallback(
    (restaurant: Restaurant) => {
      setSelectedEntity('restaurant', restaurant.id);
      const [x, , z] = geoToLocal(restaurant.lat, restaurant.lon, 0);
      const y = elevationGrid ? sampleElevation(elevationGrid, x, z) : 0;
      const position: [number, number, number] = [x, y, z];
      setCameraFocusTarget({ position, distance: RESTAURANT_FOCUS_DISTANCE });
    },
    [setSelectedEntity, setCameraFocusTarget, elevationGrid]
  );

  if (visibleRestaurants.length === 0) return null;

  return (
    <group name="restaurant-labels">
      {visibleRestaurants.map((restaurant) => (
        <RestaurantPin
          key={restaurant.id}
          restaurant={restaurant}
          position={restaurant.position}
          isHovered={hoveredRestaurantId === restaurant.id}
          isSelected={selectedRestaurantId === restaurant.id}
          onHover={(id) => setHoveredEntity('restaurant', id)}
          onSelect={() => handleSelect(restaurant)}
        />
      ))}
    </group>
  );
}
