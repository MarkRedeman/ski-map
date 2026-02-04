/**
 * Hook for accessing piste data
 * 
 * Uses the combined ski data query to avoid multiple Overpass API calls.
 */

import { useSkiData, type Piste, type SkiArea } from './useSkiData'
import type { Difficulty } from '@/stores/useNavigationStore'

/**
 * Hook to get pistes from the combined ski data query
 */
export function usePistes() {
  const query = useSkiData()
  return {
    ...query,
    data: query.data?.pistes,
  }
}

/**
 * Filter pistes by difficulty
 */
export function filterPistesByDifficulty(
  pistes: Piste[] | undefined, 
  enabledDifficulties: Set<Difficulty>
): Piste[] {
  if (!pistes) return []
  return pistes.filter((piste) => enabledDifficulties.has(piste.difficulty))
}

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

// Re-export types for convenience
export type { Piste, SkiArea }
