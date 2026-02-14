import { create } from 'zustand'
import type * as THREE from 'three'
import type { ElevationGrid } from '@/lib/geo/elevationGrid'
import { SOLDEN_CENTER } from '@/config/region'

/** Lift types that can be filtered */
export type LiftType = 'Gondola' | 'Chair Lift' | 'Cable Car' | 'T-Bar' | 'Button Lift' | 'Drag Lift' | 'Magic Carpet' | 'Lift'

/** All available lift types */
export const ALL_LIFT_TYPES: LiftType[] = ['Gondola', 'Chair Lift', 'Cable Car', 'T-Bar', 'Button Lift', 'Drag Lift', 'Magic Carpet', 'Lift']

/** Entity types that can be selected */
export type EntityType = 'piste' | 'lift' | 'peak' | 'place'

/** Selection state for an entity */
export interface EntitySelection {
  type: EntityType
  id: string
}

interface MapState {
  // Terrain
  terrainGroup: THREE.Group | null
  setTerrainGroup: (group: THREE.Group | null) => void
  
  // Elevation grid for fast O(1) terrain height lookups
  elevationGrid: ElevationGrid | null
  setElevationGrid: (grid: ElevationGrid | null) => void
  
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
  
  // Selection (consolidated)
  hoveredEntity: EntitySelection | null
  selectedEntity: EntitySelection | null
  setHoveredEntity: (type: EntityType, id: string | null) => void
  setSelectedEntity: (type: EntityType, id: string | null) => void
  
  // Backward compatibility getters
  hoveredPisteId: string | null
  selectedPisteId: string | null
  hoveredLiftId: string | null
  selectedLiftId: string | null
  hoveredPeakId: string | null
  selectedPeakId: string | null
  hoveredPlaceId: string | null
  selectedPlaceId: string | null
  
  // Backward compatibility setters
  setHoveredPiste: (id: string | null) => void
  setSelectedPiste: (id: string | null) => void
  setHoveredLift: (id: string | null) => void
  setSelectedLift: (id: string | null) => void
  setHoveredPeak: (id: string | null) => void
  setSelectedPeak: (id: string | null) => void
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

const layerMap = {
  terrain: 'showTerrain' as const,
  pistes: 'showPistes' as const,
  lifts: 'showLifts' as const,
  labels: 'showLabels' as const,
}

export const useMapStore = create<MapState>((set, get) => ({
  // Terrain
  terrainGroup: null,
  setTerrainGroup: (group) => set({ terrainGroup: group }),
  
  // Elevation grid for fast lookups
  elevationGrid: null,
  setElevationGrid: (grid) => set({ elevationGrid: grid }),
  
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
    set((state) => ({
      [layerMap[layer]]: !state[layerMap[layer]],
    })),
  
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
  
  // Consolidated selection state
  hoveredEntity: null,
  selectedEntity: null,
  setHoveredEntity: (type, id) => set({ hoveredEntity: id ? { type, id } : null }),
  setSelectedEntity: (type, id) => set({ selectedEntity: id ? { type, id } : null }),
  
  // Backward compatibility - getters that derive from consolidated state
  get hoveredPisteId() {
    const entity = get().hoveredEntity
    return entity?.type === 'piste' ? entity.id : null
  },
  get selectedPisteId() {
    const entity = get().selectedEntity
    return entity?.type === 'piste' ? entity.id : null
  },
  get hoveredLiftId() {
    const entity = get().hoveredEntity
    return entity?.type === 'lift' ? entity.id : null
  },
  get selectedLiftId() {
    const entity = get().selectedEntity
    return entity?.type === 'lift' ? entity.id : null
  },
  get hoveredPeakId() {
    const entity = get().hoveredEntity
    return entity?.type === 'peak' ? entity.id : null
  },
  get selectedPeakId() {
    const entity = get().selectedEntity
    return entity?.type === 'peak' ? entity.id : null
  },
  get hoveredPlaceId() {
    const entity = get().hoveredEntity
    return entity?.type === 'place' ? entity.id : null
  },
  get selectedPlaceId() {
    const entity = get().selectedEntity
    return entity?.type === 'place' ? entity.id : null
  },
  
  // Backward compatibility setters that use consolidated state
  setHoveredPiste: (id) => set({ hoveredEntity: id ? { type: 'piste', id } : null }),
  setSelectedPiste: (id) => set({ selectedEntity: id ? { type: 'piste', id } : null }),
  setHoveredLift: (id) => set({ hoveredEntity: id ? { type: 'lift', id } : null }),
  setSelectedLift: (id) => set({ selectedEntity: id ? { type: 'lift', id } : null }),
  setHoveredPeak: (id) => set({ hoveredEntity: id ? { type: 'peak', id } : null }),
  setSelectedPeak: (id) => set({ selectedEntity: id ? { type: 'peak', id } : null }),
  setHoveredPlace: (id) => set({ hoveredEntity: id ? { type: 'place', id } : null }),
  setSelectedPlace: (id) => set({ selectedEntity: id ? { type: 'place', id } : null }),
  
  hoveredSkiAreaId: null,
  setHoveredSkiArea: (id) => set({ hoveredSkiAreaId: id }),
  
  clearSelection: () => set({ 
    selectedEntity: null,
    hoveredEntity: null,
    hoveredSkiAreaId: null,
    cameraFocusTarget: null,
  }),
  
  isLoadingTerrain: true,
  setIsLoadingTerrain: (loading) => set({ isLoadingTerrain: loading }),
}))

// Re-export for convenience
export { SOLDEN_CENTER }
