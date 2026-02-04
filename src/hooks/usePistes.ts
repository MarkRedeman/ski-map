import { useQuery, queryOptions } from '@tanstack/react-query'
import { fetchPistes, type Piste } from '@/lib/api/overpass'
import type { Difficulty } from '@/stores/useNavigationStore'

export const pistesQueryOptions = queryOptions({
  queryKey: ['pistes', 'solden'],
  queryFn: fetchPistes,
  staleTime: 1000 * 60 * 60, // 1 hour - piste data is static
  gcTime: 1000 * 60 * 60 * 24, // 24 hours
})

export function usePistes() {
  return useQuery(pistesQueryOptions)
}

// Helper to filter pistes by difficulty
export function filterPistesByDifficulty(
  pistes: Piste[] | undefined, 
  enabledDifficulties: Set<Difficulty>
): Piste[] {
  if (!pistes) return []
  return pistes.filter((piste) => enabledDifficulties.has(piste.difficulty))
}
