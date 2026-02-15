/**
 * PisteList - Piste browser with ski area grouping
 */

import { useState, useMemo, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { usePistes, groupPistesBySkiArea } from '@/hooks/usePistes';
import { useMapStore } from '@/stores/useMapStore';
import { DIFFICULTY_COLORS } from '@/config/theme';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import type { Piste, Difficulty } from '@/lib/api/overpass';
import type { SearchParams } from '@/lib/url/searchSchema';

const CAMERA_DISTANCE_PISTE = 800;

/**
 * Calculate approximate length from single-segment coordinates in meters
 */
function calculateSegmentLength(coordinates: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!;
    const [lon2, lat2] = coordinates[i]!;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    length += 6371000 * c;
  }
  return length;
}

/**
 * Calculate total length of all segments in a multi-segment piste
 */
function calculateTotalLength(segments: [number, number][][]): number {
  return segments.reduce((total, seg) => total + calculateSegmentLength(seg), 0);
}

/**
 * Calculate center position of a piste (average of all coordinates)
 */
function getPisteCenter(piste: Piste): [number, number, number] {
  const allCoords = piste.coordinates.flat();
  if (allCoords.length === 0) return [0, 0, 0];

  let sumLon = 0,
    sumLat = 0;
  for (const [lon, lat] of allCoords) {
    sumLon += lon;
    sumLat += lat;
  }
  const avgLon = sumLon / allCoords.length;
  const avgLat = sumLat / allCoords.length;

  return geoToLocal(avgLat, avgLon, 0);
}

interface PisteListProps {
  searchQuery: string;
  enabledDifficulties: Set<Difficulty>;
}

export function PisteList({ searchQuery, enabledDifficulties }: PisteListProps) {
  const { data: pistes, isLoading } = usePistes();
  const hoveredPisteId = useMapStore((s) => s.getHoveredId('piste'));
  const selectedPisteId = useMapStore((s) => s.getSelectedId('piste'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);
  const setHoveredSkiArea = useMapStore((s) => s.setHoveredSkiArea);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  // Get current search params to preserve other params when selecting
  const currentSearch = useSearch({ strict: false }) as SearchParams;

  // Track collapsed ski areas
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());

  // Filter and group pistes
  const groupedPistes = useMemo(() => {
    if (!pistes) return [];

    const filtered = pistes
      .filter((piste) => enabledDifficulties.has(piste.difficulty))
      .filter((piste) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          piste.name.toLowerCase().includes(query) ||
          piste.ref?.toLowerCase().includes(query) ||
          piste.skiArea?.name.toLowerCase().includes(query)
        );
      });

    return groupPistesBySkiArea(filtered);
  }, [pistes, enabledDifficulties, searchQuery]);

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

  // Generate Link search params for a piste
  const getSelectSearch = useCallback(
    (piste: Piste) => {
      const pisteOsmId = piste.id.replace('piste-', '');
      return {
        ...currentSearch,
        select: `piste:${pisteOsmId}`,
      };
    },
    [currentSearch]
  );

  // Handle camera focus when clicking (Link handles selection)
  const handleCameraFocus = useCallback(
    (piste: Piste) => {
      const [x, , z] = getPisteCenter(piste);
      const y = elevationGrid ? sampleElevation(elevationGrid, x, z) : 0;
      const position: [number, number, number] = [x, y, z];
      setCameraFocusTarget({ position, distance: CAMERA_DISTANCE_PISTE });
    },
    [setCameraFocusTarget, elevationGrid]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-blue-400 rounded-full" />
        <span className="ml-2 text-sm">Loading pistes...</span>
      </div>
    );
  }

  const totalPistes = groupedPistes.reduce((sum, g) => sum + g.pistes.length, 0);

  if (totalPistes === 0) {
    return <div className="p-8 text-center text-sm text-white/40">No pistes found</div>;
  }

  const hasMultipleAreas = groupedPistes.length > 1;

  return (
    <>
      {groupedPistes.map(({ skiArea, pistes: areaPistes }) => {
        const areaId = skiArea?.id ?? 'unknown';
        const areaName = skiArea?.name ?? 'Other Pistes';
        const isCollapsed = collapsedAreas.has(areaId);

        return (
          <div key={areaId}>
            {/* Ski Area Header - only show if multiple areas */}
            {hasMultipleAreas && (
              <button
                onClick={() => toggleArea(areaId)}
                onMouseEnter={() => setHoveredSkiArea(areaId)}
                onMouseLeave={() => setHoveredSkiArea(null)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border-b border-white/10 transition-colors"
              >
                <span className="text-white/60 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/70 flex-1 text-left">
                  {areaName}
                </span>
                <span className="text-xs text-white/40">{areaPistes.length} pistes</span>
              </button>
            )}

            {/* Piste Items */}
            {!isCollapsed &&
              areaPistes.map((piste) => (
                <PisteListItem
                  key={piste.id}
                  piste={piste}
                  isHovered={hoveredPisteId === piste.id}
                  isSelected={selectedPisteId === piste.id}
                  onHover={(id) => setHoveredEntity('piste', id)}
                  searchParams={getSelectSearch(piste)}
                  onCameraFocus={() => handleCameraFocus(piste)}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

interface PisteListItemProps {
  piste: Piste;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  searchParams: SearchParams;
  onCameraFocus: () => void;
}

function PisteListItem({
  piste,
  isHovered,
  isSelected,
  onHover,
  searchParams,
  onCameraFocus,
}: PisteListItemProps) {
  const length = piste.length ?? calculateTotalLength(piste.coordinates);

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(piste.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected ? 'bg-white/20' : isHovered ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      {/* Difficulty indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: DIFFICULTY_COLORS[piste.difficulty] }}
      />

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{piste.name}</span>
          {piste.ref && piste.ref !== piste.name && (
            <span className="text-xs text-white/40">#{piste.ref}</span>
          )}
        </div>
        <div className="text-xs text-white/40">{(length / 1000).toFixed(1)} km</div>
      </div>

      {/* Selection indicator */}
      {isSelected && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
    </Link>
  );
}
