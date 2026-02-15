/**
 * Hook for accessing village data (villages, towns, hamlets)
 *
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Village } from './useSkiData';

/**
 * Hook to get villages from the combined ski data query
 */
export function useVillages() {
  const query = useSkiData();
  return {
    ...query,
    data: query.data?.villages,
  };
}

// Re-export types for convenience
export type { Village };
