import { useQuery, queryOptions } from '@tanstack/react-query'
import { fetchPeaks } from '@/lib/api/overpass'

export const peaksQueryOptions = queryOptions({
  queryKey: ['peaks', 'solden'],
  queryFn: fetchPeaks,
  staleTime: 1000 * 60 * 60 * 24, // 24 hours - peaks don't change
  gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
})

export function usePeaks() {
  return useQuery(peaksQueryOptions)
}
