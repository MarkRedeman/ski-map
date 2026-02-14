/**
 * useDifficultyFilter - URL-native difficulty filter hook
 *
 * Reads the `diff` search param from the URL and provides:
 * - enabledDifficulties: Set<Difficulty> of currently active difficulties
 * - toggleDifficulty: toggle a single difficulty on/off (won't allow all-off)
 * - setDifficulties: replace the entire set
 *
 * Updates go directly to the URL (no intermediate store).
 * When all difficulties are enabled, the `diff` param is omitted for clean URLs.
 */

import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ALL_DIFFICULTIES, type Difficulty } from '@/lib/api/overpass'
import type { SearchParams } from '@/lib/url/searchSchema'

export function useDifficultyFilter() {
  const search = useSearch({ strict: false }) as SearchParams
  const navigate = useNavigate()

  const enabledDifficulties = useMemo(() => {
    if (!search.diff) {
      // No diff param means all difficulties are enabled (default)
      return new Set<Difficulty>(ALL_DIFFICULTIES)
    }
    const parsed = search.diff.split(',').filter(
      (d): d is Difficulty => ALL_DIFFICULTIES.includes(d as Difficulty)
    )
    // If parsing yields nothing, fall back to all
    return parsed.length > 0 ? new Set<Difficulty>(parsed) : new Set<Difficulty>(ALL_DIFFICULTIES)
  }, [search.diff])

  const setDifficulties = useCallback(
    (difficulties: Difficulty[]) => {
      // If all are selected, omit the param for a clean URL
      const isDefault =
        difficulties.length === ALL_DIFFICULTIES.length &&
        ALL_DIFFICULTIES.every((d) => difficulties.includes(d))
      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          diff: isDefault ? undefined : difficulties.join(','),
        }),
        replace: true,
      })
    },
    [navigate]
  )

  const toggleDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const next = new Set(enabledDifficulties)
      if (next.has(difficulty)) {
        // Don't allow disabling all difficulties
        if (next.size > 1) {
          next.delete(difficulty)
        }
      } else {
        next.add(difficulty)
      }
      setDifficulties(Array.from(next))
    },
    [enabledDifficulties, setDifficulties]
  )

  return { enabledDifficulties, toggleDifficulty, setDifficulties }
}
