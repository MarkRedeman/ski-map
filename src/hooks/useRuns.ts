/**
 * TanStack Query hooks for ski runs (uploaded GPX rides)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRunsStore, selectSelectedRun } from '@/stores/useRunsStore'
import type { SkiRun } from '@/lib/garmin/types'

/**
 * Query key for runs
 */
export const runsQueryKey = ['runs'] as const

/**
 * Hook to get all runs from the store
 * Uses TanStack Query for caching and sync with store
 */
export function useRuns() {
  const loadRuns = useRunsStore((s) => s.loadRuns)
  const runs = useRunsStore((s) => s.runs)
  const isLoading = useRunsStore((s) => s.isLoading)
  const error = useRunsStore((s) => s.error)
  
  // Use query to handle initial load
  const query = useQuery({
    queryKey: runsQueryKey,
    queryFn: async () => {
      await loadRuns()
      return useRunsStore.getState().runs
    },
    // Keep synced with store
    staleTime: Infinity,
    gcTime: Infinity,
  })
  
  return {
    runs,
    isLoading: isLoading || query.isPending,
    error: error || (query.error?.message ?? null),
    refetch: query.refetch,
  }
}

/**
 * Hook to get the currently selected run
 */
export function useSelectedRun(): SkiRun | null {
  return useRunsStore(selectSelectedRun)
}

/**
 * Mutation hook for deleting a run
 */
export function useDeleteRun() {
  const queryClient = useQueryClient()
  const deleteRun = useRunsStore((s) => s.deleteRun)
  
  return useMutation({
    mutationKey: ['deleteRun'],
    mutationFn: async (id: string): Promise<void> => {
      await deleteRun(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runsQueryKey })
    },
  })
}
