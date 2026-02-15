/**
 * VillageList - Village/town/hamlet browser
 */

import { useMemo, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useVillages } from '@/hooks/useVillages';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import type { Village } from '@/lib/api/overpass';
import type { SearchParams } from '@/lib/url/searchSchema';

const CAMERA_DISTANCE_VILLAGE = 640;

interface VillageListProps {
  searchQuery: string;
}

export function VillageList({ searchQuery }: VillageListProps) {
  const { data: villages, isLoading } = useVillages();
  const hoveredVillageId = useMapStore((s) => s.getHoveredId('village'));
  const selectedVillageId = useMapStore((s) => s.getSelectedId('village'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const currentSearch = useSearch({ strict: false }) as SearchParams;

  const filteredVillages = useMemo(() => {
    if (!villages) return [];

    return villages
      .filter((village) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return village.name.toLowerCase().includes(query);
      })
      // Sort: towns first, then villages, then hamlets
      .sort((a, b) => {
        const typeOrder: Record<string, number> = { town: 0, village: 1, hamlet: 2 };
        const orderDiff = (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });
  }, [villages, searchQuery]);

  const getSelectSearch = useCallback(
    (village: Village) => {
      const villageOsmId = village.id.replace('village-', '');
      return {
        ...currentSearch,
        select: `village:${villageOsmId}`,
      };
    },
    [currentSearch]
  );

  // Handle camera focus and selection when clicking
  // Set selection in store immediately (don't wait for URL sync debounce)
  const handleCameraFocus = useCallback(
    (village: Village) => {
      setSelectedEntity('village', village.id);
      const [x, , z] = geoToLocal(village.lat, village.lon, 0);
      const y = elevationGrid ? sampleElevation(elevationGrid, x, z) : 0;
      const position: [number, number, number] = [x, y, z];
      setCameraFocusTarget({ position, distance: CAMERA_DISTANCE_VILLAGE });
    },
    [setSelectedEntity, setCameraFocusTarget, elevationGrid]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-orange-400 rounded-full" />
        <span className="ml-2 text-sm">Loading villages...</span>
      </div>
    );
  }

  if (filteredVillages.length === 0) {
    return <div className="p-8 text-center text-sm text-white/40">No villages found</div>;
  }

  return (
    <>
      {filteredVillages.map((village) => (
        <VillageListItem
          key={village.id}
          village={village}
          isHovered={hoveredVillageId === village.id}
          isSelected={selectedVillageId === village.id}
          onHover={(id) => setHoveredEntity('village', id)}
          searchParams={getSelectSearch(village)}
          onCameraFocus={() => handleCameraFocus(village)}
        />
      ))}
    </>
  );
}

interface VillageListItemProps {
  village: Village;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  searchParams: SearchParams;
  onCameraFocus: () => void;
}

function VillageListItem({
  village,
  isHovered,
  isSelected,
  onHover,
  searchParams,
  onCameraFocus,
}: VillageListItemProps) {
  const getIcon = () => {
    switch (village.type) {
      case 'town':
        return '🏘️';
      case 'village':
        return '🏠';
      case 'hamlet':
        return '🏡';
    }
  };

  const getTypeLabel = () => {
    switch (village.type) {
      case 'town':
        return 'Town';
      case 'village':
        return 'Village';
      case 'hamlet':
        return 'Hamlet';
    }
  };

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(village.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected ? 'bg-white/20' : isHovered ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      {/* Village icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-orange-500/20">
        <span className="text-sm">{getIcon()}</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{village.name}</div>
        <div className="text-xs text-white/40">{getTypeLabel()}</div>
      </div>

      {/* Selection indicator */}
      {isSelected && <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />}
    </Link>
  );
}
