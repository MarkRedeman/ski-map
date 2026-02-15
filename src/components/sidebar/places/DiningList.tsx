/**
 * DiningList - Restaurant/cafe/bar/hut browser with ski area grouping
 */

import { useState, useMemo, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import { DEFAULT_REGION } from '@/config/region';
import type { Restaurant, RestaurantType, SkiArea } from '@/lib/api/overpass';
import type { SearchParams } from '@/lib/url/searchSchema';

const CAMERA_DISTANCE_RESTAURANT = 500;

const RESTAURANT_TYPE_CONFIG: Record<RestaurantType, { icon: string; label: string }> = {
  Restaurant: { icon: '🍽️', label: 'Restaurant' },
  Cafe: { icon: '☕', label: 'Cafe' },
  Bar: { icon: '🍷', label: 'Bar' },
  'Alpine Hut': { icon: '🏔️', label: 'Alpine Hut' },
};

/**
 * Group restaurants by ski area
 * Returns an array of { skiArea, restaurants } sorted with the default region first
 */
function groupRestaurantsBySkiArea(restaurants: Restaurant[]): {
  skiArea: SkiArea | null;
  restaurants: Restaurant[];
}[] {
  const groups = new Map<string, { skiArea: SkiArea | null; restaurants: Restaurant[] }>();

  for (const restaurant of restaurants) {
    const key = restaurant.skiArea?.id ?? 'unknown';
    const existing = groups.get(key);

    if (existing) {
      existing.restaurants.push(restaurant);
    } else {
      groups.set(key, {
        skiArea: restaurant.skiArea ?? null,
        restaurants: [restaurant],
      });
    }
  }

  // Convert to array and sort (default region first, then alphabetically, unknown last)
  return Array.from(groups.values()).sort((a, b) => {
    const nameA = a.skiArea?.name ?? 'zzz';
    const nameB = b.skiArea?.name ?? 'zzz';

    if (nameA === DEFAULT_REGION.name) return -1;
    if (nameB === DEFAULT_REGION.name) return 1;

    return nameA.localeCompare(nameB);
  });
}

interface RestaurantListProps {
  searchQuery: string;
}

export function RestaurantList({ searchQuery }: RestaurantListProps) {
  const { data: restaurants, isLoading } = useRestaurants();
  const hoveredRestaurantId = useMapStore((s) => s.getHoveredId('restaurant'));
  const selectedRestaurantId = useMapStore((s) => s.getSelectedId('restaurant'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const currentSearch = useSearch({ strict: false }) as SearchParams;

  // Track collapsed ski areas
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());

  // Filter and group restaurants
  const groupedRestaurants = useMemo(() => {
    if (!restaurants) return [];

    const filtered = restaurants
      .filter((restaurant) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.type.toLowerCase().includes(query) ||
          restaurant.cuisine?.toLowerCase().includes(query)
        );
      })
      // Sort within each group: Alpine Huts first, then restaurants, cafes, bars
      .sort((a, b) => {
        const typeOrder: Record<string, number> = {
          'Alpine Hut': 0,
          Restaurant: 1,
          Cafe: 2,
          Bar: 3,
        };
        const orderDiff = (typeOrder[a.type] ?? 4) - (typeOrder[b.type] ?? 4);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });

    return groupRestaurantsBySkiArea(filtered);
  }, [restaurants, searchQuery]);

  const toggleArea = (areaId: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const getSelectSearch = useCallback(
    (restaurant: Restaurant) => {
      const restaurantOsmId = restaurant.id.replace('restaurant-', '');
      return {
        ...currentSearch,
        select: `restaurant:${restaurantOsmId}`,
      };
    },
    [currentSearch]
  );

  // Handle camera focus and selection when clicking
  // Set selection in store immediately (don't wait for URL sync debounce)
  const handleCameraFocus = useCallback(
    (restaurant: Restaurant) => {
      setSelectedEntity('restaurant', restaurant.id);
      const [x, , z] = geoToLocal(restaurant.lat, restaurant.lon, 0);
      const y = elevationGrid ? sampleElevation(elevationGrid, x, z) : 0;
      const position: [number, number, number] = [x, y, z];
      setCameraFocusTarget({ position, distance: CAMERA_DISTANCE_RESTAURANT });
    },
    [setSelectedEntity, setCameraFocusTarget, elevationGrid]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-emerald-400 rounded-full" />
        <span className="ml-2 text-sm">Loading restaurants...</span>
      </div>
    );
  }

  const totalRestaurants = groupedRestaurants.reduce((sum, g) => sum + g.restaurants.length, 0);

  if (totalRestaurants === 0) {
    return <div className="p-8 text-center text-sm text-white/40">No restaurants found</div>;
  }

  const hasMultipleAreas = groupedRestaurants.length > 1;

  return (
    <>
      {groupedRestaurants.map(({ skiArea, restaurants: areaRestaurants }) => {
        const areaId = skiArea?.id ?? 'unknown';
        const areaName = skiArea?.name ?? 'Other Dining';
        const isCollapsed = collapsedAreas.has(areaId);

        return (
          <div key={areaId}>
            {/* Ski Area Header - only show if multiple areas */}
            {hasMultipleAreas && (
              <button
                onClick={() => toggleArea(areaId)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border-b border-white/10 transition-colors"
              >
                <span className="text-white/60 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/70 flex-1 text-left">
                  {areaName}
                </span>
                <span className="text-xs text-white/40">{areaRestaurants.length}</span>
              </button>
            )}

            {/* Restaurant Items */}
            {!isCollapsed &&
              areaRestaurants.map((restaurant) => (
                <RestaurantListItem
                  key={restaurant.id}
                  restaurant={restaurant}
                  isHovered={hoveredRestaurantId === restaurant.id}
                  isSelected={selectedRestaurantId === restaurant.id}
                  onHover={(id) => setHoveredEntity('restaurant', id)}
                  searchParams={getSelectSearch(restaurant)}
                  onCameraFocus={() => handleCameraFocus(restaurant)}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

interface RestaurantListItemProps {
  restaurant: Restaurant;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  searchParams: SearchParams;
  onCameraFocus: () => void;
}

function RestaurantListItem({
  restaurant,
  isHovered,
  isSelected,
  onHover,
  searchParams,
  onCameraFocus,
}: RestaurantListItemProps) {
  const config = RESTAURANT_TYPE_CONFIG[restaurant.type] ?? RESTAURANT_TYPE_CONFIG['Restaurant'];

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(restaurant.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected ? 'bg-white/20' : isHovered ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      {/* Restaurant icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-emerald-500/20">
        <span className="text-sm">{config.icon}</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{restaurant.name}</div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{config.label}</span>
          {restaurant.cuisine && (
            <>
              <span>·</span>
              <span className="truncate">{restaurant.cuisine}</span>
            </>
          )}
          {restaurant.elevation != null && (
            <>
              <span>·</span>
              <span>{restaurant.elevation.toLocaleString()} m</span>
            </>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
    </Link>
  );
}
