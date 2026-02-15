/**
 * PeakList - Peak browser sorted by elevation
 */

import { useMemo, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { usePeaks } from '@/hooks/usePeaks';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal } from '@/lib/geo/coordinates';
import type { Peak } from '@/lib/api/overpass';
import type { SearchParams } from '@/lib/url/searchSchema';

const CAMERA_DISTANCE_PEAK = 600;

interface PeakListProps {
  searchQuery: string;
}

export function PeakList({ searchQuery }: PeakListProps) {
  const { data: peaks, isLoading } = usePeaks();
  const hoveredPeakId = useMapStore((s) => s.getHoveredId('peak'));
  const selectedPeakId = useMapStore((s) => s.getSelectedId('peak'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setSelectedEntity = useMapStore((s) => s.setSelectedEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);

  const currentSearch = useSearch({ strict: false }) as SearchParams;

  const filteredPeaks = useMemo(() => {
    if (!peaks) return [];

    return peaks
      .filter((peak) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return peak.name.toLowerCase().includes(query);
      })
      // Sort by elevation descending (highest first)
      .sort((a, b) => (b.elevation ?? 0) - (a.elevation ?? 0));
  }, [peaks, searchQuery]);

  const getSelectSearch = useCallback(
    (peak: Peak) => {
      const peakOsmId = peak.id.replace('peak-', '');
      return {
        ...currentSearch,
        select: `peak:${peakOsmId}`,
      };
    },
    [currentSearch]
  );

  // Handle camera focus and selection when clicking
  // Set selection in store immediately (don't wait for URL sync debounce)
  const handleCameraFocus = useCallback(
    (peak: Peak) => {
      setSelectedEntity('peak', peak.id);
      const position = geoToLocal(peak.lat, peak.lon, peak.elevation);
      setCameraFocusTarget({ position, distance: CAMERA_DISTANCE_PEAK });
    },
    [setSelectedEntity, setCameraFocusTarget]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-purple-400 rounded-full" />
        <span className="ml-2 text-sm">Loading peaks...</span>
      </div>
    );
  }

  if (filteredPeaks.length === 0) {
    return <div className="p-8 text-center text-sm text-white/40">No peaks found</div>;
  }

  return (
    <>
      {filteredPeaks.map((peak) => (
        <PeakListItem
          key={peak.id}
          peak={peak}
          isHovered={hoveredPeakId === peak.id}
          isSelected={selectedPeakId === peak.id}
          onHover={(id) => setHoveredEntity('peak', id)}
          searchParams={getSelectSearch(peak)}
          onCameraFocus={() => handleCameraFocus(peak)}
        />
      ))}
    </>
  );
}

interface PeakListItemProps {
  peak: Peak;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  searchParams: SearchParams;
  onCameraFocus: () => void;
}

function PeakListItem({
  peak,
  isHovered,
  isSelected,
  onHover,
  searchParams,
  onCameraFocus,
}: PeakListItemProps) {
  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(peak.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected ? 'bg-white/20' : isHovered ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      {/* Peak icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-purple-500/20">
        <span className="text-sm">⛰️</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{peak.name}</div>
        <div className="text-xs text-white/40">{peak.elevation?.toLocaleString() ?? '?'} m</div>
      </div>

      {/* Selection indicator */}
      {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
    </Link>
  );
}
