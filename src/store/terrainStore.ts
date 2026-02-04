/**
 * Terrain state store using Zustand
 * 
 * Stores the elevation grid so other components (pistes, lifts, contours)
 * can sample terrain height for proper 3D positioning.
 */

import { create } from 'zustand'
import type { ElevationGrid } from '@/lib/geo/elevationGrid'

interface TerrainState {
  /** Elevation grid for terrain height sampling */
  elevationGrid: ElevationGrid | null
  /** Whether terrain data is currently loading */
  isLoading: boolean
  /** Set the elevation grid */
  setElevationGrid: (grid: ElevationGrid | null) => void
  /** Set loading state */
  setIsLoading: (loading: boolean) => void
}

export const useTerrainStore = create<TerrainState>((set) => ({
  elevationGrid: null,
  isLoading: true,
  setElevationGrid: (grid) => set({ elevationGrid: grid }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
