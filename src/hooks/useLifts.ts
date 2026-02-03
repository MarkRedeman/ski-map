import { useQuery, queryOptions } from '@tanstack/react-query'
import { fetchLifts } from '@/lib/api/overpass'

export const liftsQueryOptions = queryOptions({
  queryKey: ['lifts', 'solden'],
  queryFn: fetchLifts,
  staleTime: 1000 * 60 * 60, // 1 hour - lift data is static
  gcTime: 1000 * 60 * 60 * 24, // 24 hours
})

export function useLifts() {
  return useQuery(liftsQueryOptions)
}
