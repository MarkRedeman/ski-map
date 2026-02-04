/**
 * Combined hook for fetching all ski data in a single Overpass API request
 * 
 * This replaces the individual usePistes, useLifts, usePeaks, usePlaces hooks
 * by fetching everything at once, reducing API calls from 5 to 1.
 */

import { useQuery, queryOptions } from '@tanstack/react-query'
import { 
  fetchAllSkiData, 
  type SkiData, 
  type Piste, 
  type Lift, 
  type Peak, 
  type Place,
  type SkiArea,
} from '@/lib/api/overpass'
import { mergePisteSegments } from '@/lib/api/mergePistes'

/**
 * Processed ski data with merged piste segments
 */
export interface ProcessedSkiData {
  pistes: Piste[]
  lifts: Lift[]
  skiAreas: SkiArea[]
  peaks: Peak[]
  places: Place[]
}

/**
 * Query options for fetching all ski data
 * - Single Overpass API request for all data types
 * - Merges fragmented piste segments
 * - Caches for 1 hour (ski data is relatively static)
 */
export const skiDataQueryOptions = queryOptions({
  queryKey: ['skiData', 'solden'],
  queryFn: async (): Promise<ProcessedSkiData> => {
    const data = await fetchAllSkiData()
    
    // Merge fragmented piste segments
    const mergedPistes = mergePisteSegments(data.pistes)
    
    return {
      pistes: mergedPistes,
      lifts: data.lifts,
      skiAreas: data.skiAreas,
      peaks: data.peaks,
      places: data.places,
    }
  },
  staleTime: 1000 * 60 * 60, // 1 hour
  gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days (for persistence)
})

/**
 * Hook to fetch all ski data at once
 */
export function useSkiData() {
  return useQuery(skiDataQueryOptions)
}

/**
 * Selector hooks for individual data types
 * These use the combined query but return only the requested data
 */

export function usePistesFromSkiData() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.pistes,
  }
}

export function useLiftsFromSkiData() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.lifts,
  }
}

export function usePeaksFromSkiData() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.peaks,
  }
}

export function usePlacesFromSkiData() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.places,
  }
}

// Re-export types for convenience
export type { Piste, Lift, Peak, Place, SkiArea, SkiData }
