import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type Difficulty = 'blue' | 'red' | 'black'

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

interface NavigationState {
  // Filters
  enabledDifficulties: Set<Difficulty>
  toggleDifficulty: (difficulty: Difficulty) => void
  setDifficulties: (difficulties: Difficulty[]) => void

  // Navigation
  fromLocation: Location | null
  toLocation: Location | null
  setFromLocation: (location: Location | null) => void
  setToLocation: (location: Location | null) => void
  swapLocations: () => void

  // Current route
  selectedRoute: Route | null
  setSelectedRoute: (route: Route | null) => void
  isCalculating: boolean
  setIsCalculating: (calculating: boolean) => void

  // User location
  userLocation: [number, number, number] | null // [lat, lon, elevation]
  setUserLocation: (location: [number, number, number] | null) => void
  isTrackingLocation: boolean
  setIsTrackingLocation: (tracking: boolean) => void
}

export const useNavigationStore = create<NavigationState>()(
  subscribeWithSelector((set) => ({
    // Default: all difficulties enabled
    enabledDifficulties: new Set<Difficulty>(['blue', 'red', 'black']),
    
    toggleDifficulty: (difficulty) =>
      set((state) => {
        const newSet = new Set(state.enabledDifficulties)
        if (newSet.has(difficulty)) {
          // Don't allow disabling all difficulties
          if (newSet.size > 1) {
            newSet.delete(difficulty)
          }
        } else {
          newSet.add(difficulty)
        }
        return { enabledDifficulties: newSet }
      }),

    setDifficulties: (difficulties) =>
      set({ enabledDifficulties: new Set(difficulties) }),

    fromLocation: null,
    toLocation: null,
    
    setFromLocation: (location) => set({ fromLocation: location }),
    setToLocation: (location) => set({ toLocation: location }),
    
    swapLocations: () =>
      set((state) => ({
        fromLocation: state.toLocation,
        toLocation: state.fromLocation,
      })),

    selectedRoute: null,
    setSelectedRoute: (route) => set({ selectedRoute: route }),
    
    isCalculating: false,
    setIsCalculating: (calculating) => set({ isCalculating: calculating }),

    userLocation: null,
    setUserLocation: (location) => set({ userLocation: location }),
    
    isTrackingLocation: false,
    setIsTrackingLocation: (tracking) => set({ isTrackingLocation: tracking }),
  }))
)
