/**
 * Combined hook for fetching all ski data in a single Overpass API request
 *
 * This replaces the individual usePistes, useLifts, usePeaks, useVillages hooks
 * by fetching everything at once, reducing API calls from 5 to 1.
 *
 * All heavy computation (parsing, spatial assignment, segment merging) is
 * delegated to a Web Worker via Comlink to avoid blocking the main thread.
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import * as Comlink from 'comlink';
import type {
  SkiData,
  Piste,
  Lift,
  Peak,
  Village,
  Restaurant,
  SkiArea,
  SkiAreaPolygon,
} from '@/lib/api/overpass';
import { getRegionBbox } from '@/stores/useAppConfigStore';
import type { SkiDataWorkerApi } from '@/workers/skiData.worker';

/**
 * Processed ski data with merged piste segments
 */
export interface ProcessedSkiData {
  pistes: Piste[];
  lifts: Lift[];
  skiAreas: SkiAreaPolygon[]; // All ski areas with polygon boundaries
  peaks: Peak[];
  villages: Village[];
  restaurants: Restaurant[];
}

/**
 * Singleton worker instance — created once, reused across queries.
 */
let workerInstance: Comlink.Remote<SkiDataWorkerApi> | null = null;

function getSkiDataWorker(): Comlink.Remote<SkiDataWorkerApi> {
  if (!workerInstance) {
    const worker = new Worker(new URL('@/workers/skiData.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerInstance = Comlink.wrap<SkiDataWorkerApi>(worker);
  }
  return workerInstance;
}

/**
 * Query options for fetching all ski data
 * - Single Overpass API request for all data types
 * - Assigns ski areas via spatial containment
 * - Merges fragmented piste segments
 * - All processing runs in a Web Worker (off main thread)
 * - Caches for 1 hour (ski data is relatively static)
 */
export const skiDataQueryOptions = queryOptions({
  queryKey: ['skiData', 'region'],
  queryFn: async (): Promise<ProcessedSkiData> => {
    const bbox = getRegionBbox();
    const worker = getSkiDataWorker();
    return worker.processSkiData(bbox);
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
export type { Piste, Lift, Peak, Village, Restaurant, SkiArea, SkiAreaPolygon, SkiData };
