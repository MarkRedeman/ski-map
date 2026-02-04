import { useQuery, queryOptions } from '@tanstack/react-query'
import { fetchPistesWithSkiAreas, type Piste, type SkiArea } from '@/lib/api/overpass'
import { mergePisteSegments } from '@/lib/api/mergePistes'
import type { Difficulty } from '@/stores/useNavigationStore'

/**
 * Query options for fetching and merging pistes
 * - Fetches raw pistes with ski area assignments
 * - Merges fragmented segments into unified pistes
 * - Caches for 1 hour (piste data is relatively static)
 */
export const pistesQueryOptions = queryOptions({
  queryKey: ['pistes', 'solden', 'merged'],
  queryFn: async () => {
    const rawPistes = await fetchPistesWithSkiAreas()
    return mergePisteSegments(rawPistes)
  },
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

// Re-export types for convenience
export type { Piste, SkiArea }

/**
 * Group pistes by ski area
 * Returns an array of { skiArea, pistes } sorted with Sölden first
 */
export function groupPistesBySkiArea(pistes: Piste[]): {
  skiArea: SkiArea | null
  pistes: Piste[]
}[] {
  const groups = new Map<string, { skiArea: SkiArea | null; pistes: Piste[] }>()
  
  for (const piste of pistes) {
    const key = piste.skiArea?.id ?? 'unknown'
    const existing = groups.get(key)
    
    if (existing) {
      existing.pistes.push(piste)
    } else {
      groups.set(key, {
        skiArea: piste.skiArea ?? null,
        pistes: [piste],
      })
    }
  }
  
  // Convert to array and sort (Sölden first, then alphabetically, unknown last)
  return Array.from(groups.values()).sort((a, b) => {
    const nameA = a.skiArea?.name ?? 'zzz'
    const nameB = b.skiArea?.name ?? 'zzz'
    
    if (nameA === 'Sölden') return -1
    if (nameB === 'Sölden') return 1
    
    return nameA.localeCompare(nameB)
  })
}
