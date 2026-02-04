/**
 * Hook for accessing lift data
 * 
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Lift } from './useSkiData'

/**
 * Hook to get lifts from the combined ski data query
 */
export function useLifts() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.lifts,
  }
}

// Re-export types for convenience
export type { Lift }
