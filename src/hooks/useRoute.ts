/**
 * Hook for calculating ski routes using TanStack Query
 */

import { useQuery, queryOptions } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Difficulty } from '@/lib/api/overpass'
import type { Location, Route } from '@/stores/useNavigationStore'
import { buildGraph, findRoute } from '@/lib/routing'
import { usePistes } from './usePistes'
import { useLifts } from './useLifts'

/**
 * Calculate route between two locations
 */
async function calculateRoute(
  pistes: Awaited<ReturnType<typeof usePistes>>['data'],
  lifts: Awaited<ReturnType<typeof useLifts>>['data'],
  from: Location,
  to: Location,
  enabledDifficulties: Set<Difficulty>
): Promise<Route | null> {
  if (!pistes || !lifts) {
    return null
  }
  
  // Build the navigation graph
  const graph = buildGraph(pistes, lifts)
  
  // Find route
  const route = findRoute(graph, from, to, enabledDifficulties)
  
  return route
}

/**
 * Create query options for route calculation
 */
export function routeQueryOptions(
  pistes: Awaited<ReturnType<typeof usePistes>>['data'],
  lifts: Awaited<ReturnType<typeof useLifts>>['data'],
  from: Location | null,
  to: Location | null,
  enabledDifficulties: Set<Difficulty>
) {
  return queryOptions({
    queryKey: [
      'route',
      from?.id ?? null,
      to?.id ?? null,
      Array.from(enabledDifficulties).sort().join(','),
    ],
    queryFn: async () => {
      if (!from || !to || !pistes || !lifts) {
        return null
      }
      return calculateRoute(pistes, lifts, from, to, enabledDifficulties)
    },
    enabled: !!from && !!to && !!pistes && !!lifts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  })
}

/**
 * Hook to calculate and manage route state
 */
export function useRoute(
  from: Location | null,
  to: Location | null,
  enabledDifficulties: Set<Difficulty>
) {
  const { data: pistes, isLoading: pistesLoading } = usePistes()
  const { data: lifts, isLoading: liftsLoading } = useLifts()
  
  const options = useMemo(
    () => routeQueryOptions(pistes, lifts, from, to, enabledDifficulties),
    [pistes, lifts, from, to, enabledDifficulties]
  )
  
  const query = useQuery(options)
  
  return {
    ...query,
    isLoading: query.isPending || pistesLoading || liftsLoading,
  }
}

/**
 * Hook to trigger route calculation on demand
 */
export function useRouteCalculation() {
  const { data: pistes, isLoading: pistesLoading } = usePistes()
  const { data: lifts, isLoading: liftsLoading } = useLifts()
  
  const isReady = !pistesLoading && !liftsLoading && !!pistes && !!lifts
  
  const calculate = useMemo(() => {
    if (!isReady || !pistes || !lifts) {
      return null
    }
    
    return (
      from: Location,
      to: Location,
      enabledDifficulties: Set<Difficulty>
    ): Route | null => {
      const graph = buildGraph(pistes, lifts)
      return findRoute(graph, from, to, enabledDifficulties)
    }
  }, [isReady, pistes, lifts])
  
  return {
    isReady,
    calculate,
  }
}
