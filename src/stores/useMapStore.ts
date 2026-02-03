import { create } from 'zustand'

interface MapState {
  // Camera
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  setCameraPosition: (position: [number, number, number]) => void
  setCameraTarget: (target: [number, number, number]) => void
  
  // View mode
  viewMode: 'overview' | 'follow' | 'free'
  setViewMode: (mode: 'overview' | 'follow' | 'free') => void
  
  // Layers
  showTerrain: boolean
  showPistes: boolean
  showLifts: boolean
  showLabels: boolean
  toggleLayer: (layer: 'terrain' | 'pistes' | 'lifts' | 'labels') => void
  
  // Selection
  hoveredPisteId: string | null
  selectedPisteId: string | null
  setHoveredPiste: (id: string | null) => void
  setSelectedPiste: (id: string | null) => void
  
  // Loading state
  isLoadingTerrain: boolean
  setIsLoadingTerrain: (loading: boolean) => void
}

// Sölden center coordinates (Giggijoch area)
const SOLDEN_CENTER: [number, number, number] = [46.9147, 10.9975, 2000]

export const useMapStore = create<MapState>((set) => ({
  // Default camera looking at Sölden from above
  cameraPosition: [0, 500, 300],
  cameraTarget: [0, 0, 0],
  setCameraPosition: (position) => set({ cameraPosition: position }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  
  viewMode: 'overview',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // All layers visible by default
  showTerrain: true,
  showPistes: true,
  showLifts: true,
  showLabels: true,
  
  toggleLayer: (layer) =>
    set((state) => {
      switch (layer) {
        case 'terrain':
          return { showTerrain: !state.showTerrain }
        case 'pistes':
          return { showPistes: !state.showPistes }
        case 'lifts':
          return { showLifts: !state.showLifts }
        case 'labels':
          return { showLabels: !state.showLabels }
        default:
          return state
      }
    }),
  
  hoveredPisteId: null,
  selectedPisteId: null,
  setHoveredPiste: (id) => set({ hoveredPisteId: id }),
  setSelectedPiste: (id) => set({ selectedPisteId: id }),
  
  isLoadingTerrain: true,
  setIsLoadingTerrain: (loading) => set({ isLoadingTerrain: loading }),
}))

// Export center for use elsewhere
export { SOLDEN_CENTER }
