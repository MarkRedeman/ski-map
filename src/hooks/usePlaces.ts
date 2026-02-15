/**
 * Hook for accessing place data (villages, towns, hamlets)
 *
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Place } from './useSkiData';

/**
 * Hook to get places from the combined ski data query
 */
export function usePlaces() {
  const query = useSkiData();
  return {
    ...query,
    data: query.data?.places,
  };
}

// Re-export types for convenience
export type { Place };
