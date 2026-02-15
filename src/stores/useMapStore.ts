import { create } from 'zustand';
import type * as THREE from 'three';
import type { ElevationGrid } from '@/lib/geo/elevationGrid';
import { SOLDEN_CENTER } from '@/config/region';

/** Lift types that can be filtered */
export type LiftType =
  | 'Gondola'
  | 'Chair Lift'
  | 'Cable Car'
  | 'T-Bar'
  | 'Button Lift'
  | 'Drag Lift'
  | 'Magic Carpet'
  | 'Lift';

/** All available lift types */
export const ALL_LIFT_TYPES: LiftType[] = [
  'Gondola',
  'Chair Lift',
  'Cable Car',
  'T-Bar',
  'Button Lift',
  'Drag Lift',
  'Magic Carpet',
  'Lift',
];

/** Entity types that can be selected */
export type EntityType = 'piste' | 'lift' | 'peak' | 'place';

/** Selection state for an entity */
export interface EntitySelection {
  type: EntityType;
  id: string;
}

interface MapState {
  // Terrain
  terrainGroup: THREE.Group | null;
  setTerrainGroup: (group: THREE.Group | null) => void;

  // Elevation grid for fast O(1) terrain height lookups
  elevationGrid: ElevationGrid | null;
  setElevationGrid: (grid: ElevationGrid | null) => void;

  // Camera
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  setCameraPosition: (position: [number, number, number]) => void;
  setCameraTarget: (target: [number, number, number]) => void;

  // Camera focus target (for animated navigation)
  cameraFocusTarget: { position: [number, number, number]; distance: number } | null;
  setCameraFocusTarget: (
    target: { position: [number, number, number]; distance: number } | null
  ) => void;

  // View mode
  viewMode: 'overview' | 'follow' | 'free';
  setViewMode: (mode: 'overview' | 'follow' | 'free') => void;

  // Layers
  showTerrain: boolean;
  showPistes: boolean;
  showLifts: boolean;
  showLabels: boolean;
  toggleLayer: (layer: 'terrain' | 'pistes' | 'lifts' | 'labels') => void;
  setShowPistes: (show: boolean) => void;
  setShowLifts: (show: boolean) => void;

  // Lift type filter - which lift types are visible
  visibleLiftTypes: Set<LiftType>;
  toggleLiftType: (liftType: LiftType) => void;
  setAllLiftTypesVisible: (visible: boolean) => void;

  // Selection (consolidated)
  hoveredEntity: EntitySelection | null;
  selectedEntity: EntitySelection | null;
  setHoveredEntity: (type: EntityType, id: string | null) => void;
  setSelectedEntity: (type: EntityType, id: string | null) => void;

  // Helper selectors
  getHoveredId: (type: EntityType) => string | null;
  getSelectedId: (type: EntityType) => string | null;

  // Ski Area hover (for polygon visualization)
  hoveredSkiAreaId: string | null;
  setHoveredSkiArea: (id: string | null) => void;

  // Clear all selection
  clearSelection: () => void;

  // Loading state
  isLoadingTerrain: boolean;
  setIsLoadingTerrain: (loading: boolean) => void;
}

const layerMap = {
  terrain: 'showTerrain' as const,
  pistes: 'showPistes' as const,
  lifts: 'showLifts' as const,
  labels: 'showLabels' as const,
};

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
      const newSet = new Set(state.visibleLiftTypes);
      if (newSet.has(liftType)) {
        newSet.delete(liftType);
      } else {
        newSet.add(liftType);
      }
      return { visibleLiftTypes: newSet };
    }),

  setAllLiftTypesVisible: (visible) =>
    set(() => ({
      visibleLiftTypes: visible ? new Set(ALL_LIFT_TYPES) : new Set(),
    })),

  // Consolidated selection state
  hoveredEntity: null,
  selectedEntity: null,
  setHoveredEntity: (type, id) => set({ hoveredEntity: id ? { type, id } : null }),
  setSelectedEntity: (type, id) => set({ selectedEntity: id ? { type, id } : null }),

  // Helper selectors
  getHoveredId: (type) => {
    const entity = get().hoveredEntity;
    return entity?.type === type ? entity.id : null;
  },
  getSelectedId: (type) => {
    const entity = get().selectedEntity;
    return entity?.type === type ? entity.id : null;
  },

  hoveredSkiAreaId: null,
  setHoveredSkiArea: (id) => set({ hoveredSkiAreaId: id }),

  clearSelection: () =>
    set({
      selectedEntity: null,
      hoveredEntity: null,
      hoveredSkiAreaId: null,
      cameraFocusTarget: null,
    }),

  isLoadingTerrain: true,
  setIsLoadingTerrain: (loading) => set({ isLoadingTerrain: loading }),
}));

// Re-export for convenience
export { SOLDEN_CENTER };
