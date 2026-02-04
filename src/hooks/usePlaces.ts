import { useQuery, queryOptions } from '@tanstack/react-query'
import { fetchPlaces } from '@/lib/api/overpass'

export const placesQueryOptions = queryOptions({
  queryKey: ['places', 'solden'],
  queryFn: fetchPlaces,
  staleTime: 1000 * 60 * 60 * 24, // 24 hours - places don't change
  gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
})

export function usePlaces() {
  return useQuery(placesQueryOptions)
}
