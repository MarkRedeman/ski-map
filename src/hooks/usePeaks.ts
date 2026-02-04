/**
 * Hook for accessing peak data
 * 
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Peak } from './useSkiData'

/**
 * Hook to get peaks from the combined ski data query
 */
export function usePeaks() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.peaks,
  }
}

// Re-export types for convenience
export type { Peak }
