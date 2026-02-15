/**
 * Combined hook for fetching all ski data in a single Overpass API request
 *
 * This replaces the individual usePistes, useLifts, usePeaks, usePlaces hooks
 * by fetching everything at once, reducing API calls from 5 to 1.
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import {
  fetchAllSkiData,
  type SkiData,
  type Piste,
  type Lift,
  type Peak,
  type Place,
  type SkiArea,
  type SkiAreaPolygon,
} from '@/lib/api/overpass';
import { mergePisteSegments } from '@/lib/api/mergePistes';
import { assignSkiAreas } from '@/lib/api/assignSkiAreas';

/**
 * Processed ski data with merged piste segments
 */
export interface ProcessedSkiData {
  pistes: Piste[];
  lifts: Lift[];
  skiAreas: SkiAreaPolygon[]; // All ski areas with polygon boundaries
  peaks: Peak[];
  places: Place[];
}

/**
 * Query options for fetching all ski data
 * - Single Overpass API request for all data types
 * - Assigns ski areas via spatial containment
 * - Merges fragmented piste segments
 * - Caches for 1 hour (ski data is relatively static)
 */
export const skiDataQueryOptions = queryOptions({
  queryKey: ['skiData', 'region'],
  queryFn: async (): Promise<ProcessedSkiData> => {
    const data = await fetchAllSkiData();

    // Assign ski areas to pistes and lifts using spatial containment
    const { pistes: pistesWithAreas, lifts: liftsWithAreas } = assignSkiAreas(
      data.pistes,
      data.lifts,
      data.skiAreaPolygons
    );

    // Merge fragmented piste segments
    const mergedPistes = mergePisteSegments(pistesWithAreas);

    return {
      pistes: mergedPistes,
      lifts: liftsWithAreas,
      skiAreas: data.skiAreaPolygons, // Now includes all ski areas with polygon data
      peaks: data.peaks,
      places: data.places,
    };
  },
  staleTime: 1000 * 60 * 60, // 1 hour
  gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days (for persistence)
});

/**
 * Hook to fetch all ski data at once
 */
export function useSkiData() {
  return useQuery(skiDataQueryOptions);
}

// Re-export types for convenience
export type { Piste, Lift, Peak, Place, SkiArea, SkiAreaPolygon, SkiData };
