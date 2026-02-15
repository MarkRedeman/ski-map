/**
 * Hook for accessing restaurant data (restaurants, cafes, bars, alpine huts)
 *
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Restaurant } from './useSkiData';

/**
 * Hook to get restaurants from the combined ski data query
 */
export function useRestaurants() {
  const query = useSkiData();
  return {
    ...query,
    data: query.data?.restaurants,
  };
}

// Re-export types for convenience
export type { Restaurant };
