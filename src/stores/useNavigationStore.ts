import { create } from 'zustand'
import type { Difficulty } from '@/lib/api/overpass'

export interface Location {
  id: string
  name: string
  type: 'piste_start' | 'piste_end' | 'lift_station' | 'intersection' | 'poi'
  coordinates: [number, number, number] // [lat, lon, elevation]
}

export interface RouteStep {
  type: 'piste' | 'lift'
  name: string
  difficulty?: Difficulty
  from: Location
  to: Location
  distance: number
  elevationChange: number
}

export interface Route {
  id: string
  from: Location
  to: Location
  steps: RouteStep[]
  totalDistance: number
  totalElevationDown: number
  totalElevationUp: number
  estimatedTime: number // minutes
  maxDifficulty: Difficulty
}

interface RoutePlanningState {
  // Route planning
  fromLocation: Location | null
  toLocation: Location | null
  setFromLocation: (location: Location | null) => void
  setToLocation: (location: Location | null) => void
  swapLocations: () => void
  
  // Quick destination setter (for clicking on map)
  setDestination: (dest: { id: string; name: string; coordinates: [number, number, number]; type: string }) => void

  // Current route
  selectedRoute: Route | null
  setSelectedRoute: (route: Route | null) => void
  isCalculating: boolean
  setIsCalculating: (calculating: boolean) => void

  // User location / geolocation
  userLocation: [number, number, number] | null // [lat, lon, elevation]
  setUserLocation: (location: [number, number, number] | null) => void
  userAccuracy: number | null // GPS accuracy in meters
  setUserAccuracy: (accuracy: number | null) => void
  userHeading: number | null // Device heading in degrees (0 = north)
  setUserHeading: (heading: number | null) => void
  isTrackingLocation: boolean
  setIsTrackingLocation: (tracking: boolean) => void
}

export const useRoutePlanningStore = create<RoutePlanningState>()((set) => ({
  fromLocation: null,
  toLocation: null,
  
  setFromLocation: (location) => set({ fromLocation: location }),
  setToLocation: (location) => set({ toLocation: location }),
  
  swapLocations: () =>
    set((state) => ({
      fromLocation: state.toLocation,
      toLocation: state.fromLocation,
    })),
  
  setDestination: (dest) =>
    set({
      toLocation: {
        id: dest.id,
        name: dest.name,
        coordinates: dest.coordinates,
        type: dest.type === 'piste' ? 'piste_end' : 'lift_station',
      },
    }),

  selectedRoute: null,
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  
  isCalculating: false,
  setIsCalculating: (calculating) => set({ isCalculating: calculating }),

  userLocation: null,
  setUserLocation: (location) => set({ userLocation: location }),
  
  userAccuracy: null,
  setUserAccuracy: (accuracy) => set({ userAccuracy: accuracy }),
  
  userHeading: null,
  setUserHeading: (heading) => set({ userHeading: heading }),
  
  isTrackingLocation: false,
  setIsTrackingLocation: (tracking) => set({ isTrackingLocation: tracking }),
}))
