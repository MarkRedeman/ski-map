/**
 * LiftList - Lift browser with type filtering
 */

import { useMemo, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useLifts } from '@/hooks/useLifts';
import { useMapStore, type LiftType } from '@/stores/useMapStore';
import { LIFT_TYPE_CONFIG } from '@/config/theme';
import { geoToLocal } from '@/lib/geo/coordinates';
import { sampleElevation } from '@/lib/geo/elevationGrid';
import type { Lift } from '@/lib/api/overpass';
import type { SearchParams } from '@/lib/url/searchSchema';

const CAMERA_DISTANCE_LIFT = 700;

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
 * Calculate center position of a lift (average of all coordinates)
 */
function getLiftCenter(lift: Lift): [number, number, number] {
  if (lift.coordinates.length === 0) return [0, 0, 0];

  let sumLon = 0,
    sumLat = 0;
  for (const [lon, lat] of lift.coordinates) {
    sumLon += lon;
    sumLat += lat;
  }
  const avgLon = sumLon / lift.coordinates.length;
  const avgLat = sumLat / lift.coordinates.length;

  return geoToLocal(avgLat, avgLon, 0);
}

interface LiftListProps {
  searchQuery: string;
  visibleLiftTypes: Set<LiftType>;
}

export function LiftList({ searchQuery, visibleLiftTypes }: LiftListProps) {
  const { data: lifts, isLoading } = useLifts();
  const hoveredLiftId = useMapStore((s) => s.getHoveredId('lift'));
  const selectedLiftId = useMapStore((s) => s.getSelectedId('lift'));
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);
  const elevationGrid = useMapStore((s) => s.elevationGrid);

  const currentSearch = useSearch({ strict: false }) as SearchParams;

  const filteredLifts = useMemo(() => {
    if (!lifts) return [];

    return lifts
      .filter((lift) => visibleLiftTypes.has(lift.type as LiftType))
      .filter((lift) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return lift.name.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lifts, searchQuery, visibleLiftTypes]);

  const getSelectSearch = useCallback(
    (lift: Lift) => {
      const liftOsmId = lift.id.replace('lift-', '');
      return {
        ...currentSearch,
        select: `lift:${liftOsmId}`,
      };
    },
    [currentSearch]
  );

  const handleCameraFocus = useCallback(
    (lift: Lift) => {
      const [x, , z] = getLiftCenter(lift);
      const y = elevationGrid ? sampleElevation(elevationGrid, x, z) : 0;
      const position: [number, number, number] = [x, y, z];
      setCameraFocusTarget({ position, distance: CAMERA_DISTANCE_LIFT });
    },
    [setCameraFocusTarget, elevationGrid]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-amber-400 rounded-full" />
        <span className="ml-2 text-sm">Loading lifts...</span>
      </div>
    );
  }

  if (filteredLifts.length === 0) {
    return <div className="p-8 text-center text-sm text-white/40">No lifts found</div>;
  }

  return (
    <>
      {filteredLifts.map((lift) => (
        <LiftListItem
          key={lift.id}
          lift={lift}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
          onHover={(id) => setHoveredEntity('lift', id)}
          searchParams={getSelectSearch(lift)}
          onCameraFocus={() => handleCameraFocus(lift)}
        />
      ))}
    </>
  );
}

interface LiftListItemProps {
  lift: Lift;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  searchParams: SearchParams;
  onCameraFocus: () => void;
}

function LiftListItem({
  lift,
  isHovered,
  isSelected,
  onHover,
  searchParams,
  onCameraFocus,
}: LiftListItemProps) {
  const length = useMemo(() => calculateSegmentLength(lift.coordinates), [lift.coordinates]);
  const config =
    LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift'];

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(lift.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected ? 'bg-white/20' : isHovered ? 'bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      {/* Lift type icon */}
      <div
        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}30` }}
      >
        <span className="text-sm">{config.icon}</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{lift.name}</div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{lift.type}</span>
          <span>•</span>
          <span>{(length / 1000).toFixed(1)} km</span>
          {lift.capacity && (
            <>
              <span>•</span>
              <span>{lift.capacity}/h</span>
            </>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
    </Link>
  );
}
