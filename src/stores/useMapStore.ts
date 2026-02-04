import { create } from 'zustand'
import type * as THREE from 'three'
import type { ElevationGrid, ChunkElevationMap } from '@/lib/geo/elevationGrid'

/** Lift types that can be filtered */
export type LiftType = 'Gondola' | 'Chair Lift' | 'Cable Car' | 'T-Bar' | 'Button Lift' | 'Drag Lift' | 'Magic Carpet' | 'Lift'

/** All available lift types */
export const ALL_LIFT_TYPES: LiftType[] = ['Gondola', 'Chair Lift', 'Cable Car', 'T-Bar', 'Button Lift', 'Drag Lift', 'Magic Carpet', 'Lift']

interface MapState {
  // Terrain mesh reference for raycasting (legacy, kept for compatibility)
  terrainMesh: THREE.Mesh | null
  setTerrainMesh: (mesh: THREE.Mesh | null) => void
  
  // Terrain group for chunked terrain raycasting
  terrainGroup: THREE.Group | null
  setTerrainGroup: (group: THREE.Group | null) => void
  
  // Elevation grid for fast O(1) terrain height lookups (legacy single grid)
  elevationGrid: ElevationGrid | null
  setElevationGrid: (grid: ElevationGrid | null) => void
  
  // Chunk-based elevation map for dynamic terrain
  chunkElevationMap: ChunkElevationMap | null
  setChunkElevationMap: (map: ChunkElevationMap | null) => void
  
  // Camera
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  setCameraPosition: (position: [number, number, number]) => void
  setCameraTarget: (target: [number, number, number]) => void
  
  // Camera focus target (for animated navigation)
  cameraFocusTarget: { position: [number, number, number]; distance: number } | null
  setCameraFocusTarget: (target: { position: [number, number, number]; distance: number } | null) => void
  
  // View mode
  viewMode: 'overview' | 'follow' | 'free'
  setViewMode: (mode: 'overview' | 'follow' | 'free') => void
  
  // Layers
  showTerrain: boolean
  showPistes: boolean
  showLifts: boolean
  showLabels: boolean
  toggleLayer: (layer: 'terrain' | 'pistes' | 'lifts' | 'labels') => void
  setShowPistes: (show: boolean) => void
  setShowLifts: (show: boolean) => void
  
  // Lift type filter - which lift types are visible
  visibleLiftTypes: Set<LiftType>
  toggleLiftType: (liftType: LiftType) => void
  setAllLiftTypesVisible: (visible: boolean) => void
  
  // Selection - Pistes
  hoveredPisteId: string | null
  selectedPisteId: string | null
  setHoveredPiste: (id: string | null) => void
  setSelectedPiste: (id: string | null) => void
  
  // Selection - Lifts
  hoveredLiftId: string | null
  selectedLiftId: string | null
  setHoveredLift: (id: string | null) => void
  setSelectedLift: (id: string | null) => void
  
  // Selection - Peaks
  hoveredPeakId: string | null
  selectedPeakId: string | null
  setHoveredPeak: (id: string | null) => void
  setSelectedPeak: (id: string | null) => void
  
  // Selection - Places
  hoveredPlaceId: string | null
  selectedPlaceId: string | null
  setHoveredPlace: (id: string | null) => void
  setSelectedPlace: (id: string | null) => void
  
  // Ski Area hover (for polygon visualization)
  hoveredSkiAreaId: string | null
  setHoveredSkiArea: (id: string | null) => void
  
  // Clear all selection
  clearSelection: () => void
  
  // Loading state
  isLoadingTerrain: boolean
  setIsLoadingTerrain: (loading: boolean) => void
}

// Sölden center coordinates (Giggijoch area)
const SOLDEN_CENTER: [number, number, number] = [46.9147, 10.9975, 2000]

export const useMapStore = create<MapState>((set) => ({
  // Terrain mesh for raycasting (legacy)
  terrainMesh: null,
  setTerrainMesh: (mesh) => set({ terrainMesh: mesh }),
  
  // Terrain group for chunked terrain
  terrainGroup: null,
  setTerrainGroup: (group) => set({ terrainGroup: group }),
  
  // Elevation grid for fast lookups (legacy single grid)
  elevationGrid: null,
  setElevationGrid: (grid) => set({ elevationGrid: grid }),
  
  // Chunk-based elevation map
  chunkElevationMap: null,
  setChunkElevationMap: (map) => set({ chunkElevationMap: map }),
  
  // Default camera looking at Sölden from above
  cameraPosition: [0, 500, 300],
  cameraTarget: [0, 0, 0],
  setCameraPosition: (position) => set({ cameraPosition: position }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  
  // Camera focus target for animated navigation
  cameraFocusTarget: null,
  setCameraFocusTarget: (target) => set({ cameraFocusTarget: target }),
  
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
  
  setShowPistes: (show) => set({ showPistes: show }),
  setShowLifts: (show) => set({ showLifts: show }),
  
  // Only main lift types visible by default (Gondola, Cable Car, Chair Lift)
  // Drag lifts (T-Bar, Button, Drag, Magic Carpet) hidden by default - useful for snowboarders
  visibleLiftTypes: new Set<LiftType>(['Gondola', 'Cable Car', 'Chair Lift', 'Lift']),
  
  toggleLiftType: (liftType) =>
    set((state) => {
      const newSet = new Set(state.visibleLiftTypes)
      if (newSet.has(liftType)) {
        newSet.delete(liftType)
      } else {
        newSet.add(liftType)
      }
      return { visibleLiftTypes: newSet }
    }),
  
  setAllLiftTypesVisible: (visible) =>
    set(() => ({
      visibleLiftTypes: visible ? new Set(ALL_LIFT_TYPES) : new Set()
    })),
  
  hoveredPisteId: null,
  selectedPisteId: null,
  setHoveredPiste: (id) => set({ hoveredPisteId: id }),
  setSelectedPiste: (id) => set({ 
    selectedPisteId: id, 
    selectedLiftId: null,
    selectedPeakId: null,
    selectedPlaceId: null,
  }),
  
  hoveredLiftId: null,
  selectedLiftId: null,
  setHoveredLift: (id) => set({ hoveredLiftId: id }),
  setSelectedLift: (id) => set({ 
    selectedLiftId: id, 
    selectedPisteId: null,
    selectedPeakId: null,
    selectedPlaceId: null,
  }),
  
  hoveredPeakId: null,
  selectedPeakId: null,
  setHoveredPeak: (id) => set({ hoveredPeakId: id }),
  setSelectedPeak: (id) => set({ 
    selectedPeakId: id, 
    selectedPisteId: null,
    selectedLiftId: null,
    selectedPlaceId: null,
  }),
  
  hoveredPlaceId: null,
  selectedPlaceId: null,
  setHoveredPlace: (id) => set({ hoveredPlaceId: id }),
  setSelectedPlace: (id) => set({ 
    selectedPlaceId: id, 
    selectedPisteId: null,
    selectedLiftId: null,
    selectedPeakId: null,
  }),
  
  hoveredSkiAreaId: null,
  setHoveredSkiArea: (id) => set({ hoveredSkiAreaId: id }),
  
  clearSelection: () => set({ 
    selectedPisteId: null, 
    selectedLiftId: null, 
    selectedPeakId: null,
    selectedPlaceId: null,
    hoveredPisteId: null, 
    hoveredLiftId: null,
    hoveredPeakId: null,
    hoveredPlaceId: null,
    cameraFocusTarget: null,
  }),
  
  isLoadingTerrain: true,
  setIsLoadingTerrain: (loading) => set({ isLoadingTerrain: loading }),
}))

// Export center for use elsewhere
export { SOLDEN_CENTER }
