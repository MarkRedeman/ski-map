/**
 * App Configuration Store
 *
 * Runtime-configurable settings persisted to localStorage.
 * Stores Mapbox token override and region bounds/center overrides.
 * Falls back to env vars and DEFAULT_REGION when overrides are null.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_REGION, type RegionConfig } from '@/config/region';

interface RegionBoundsOverride {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface RegionCenterOverride {
  lat: number;
  lon: number;
  elevation: number;
}

interface AppConfigState {
  /** Mapbox token override (null = use VITE_MAPBOX_TOKEN from env) */
  mapboxToken: string | null;
  /** Region bounds override (null = use defaults) */
  regionBounds: RegionBoundsOverride | null;
  /** Region center override (null = use defaults) */
  regionCenter: RegionCenterOverride | null;

  /** Set Mapbox token override */
  setMapboxToken: (token: string | null) => void;
  /** Set region bounds override */
  setRegionBounds: (bounds: RegionBoundsOverride | null) => void;
  /** Set region center override */
  setRegionCenter: (center: RegionCenterOverride | null) => void;
  /** Reset all overrides to defaults */
  resetToDefaults: () => void;
}

export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set) => ({
      mapboxToken: null,
      regionBounds: null,
      regionCenter: null,

      setMapboxToken: (token) => set({ mapboxToken: token }),
      setRegionBounds: (bounds) => set({ regionBounds: bounds }),
      setRegionCenter: (center) => set({ regionCenter: center }),
      resetToDefaults: () =>
        set({
          mapboxToken: null,
          regionBounds: null,
          regionCenter: null,
        }),
    }),
    {
      name: 'ski-map-config',
      partialize: (state) => ({
        mapboxToken: state.mapboxToken,
        regionBounds: state.regionBounds,
        regionCenter: state.regionCenter,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Helper functions — callable from anywhere (including non-React code)
// ---------------------------------------------------------------------------

/**
 * Get the effective Mapbox token (store override → env fallback)
 */
export function getMapboxToken(): string {
  const override = useAppConfigStore.getState().mapboxToken;
  if (override && override.trim()) return override.trim();
  return (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';
}

/**
 * Get the effective region center (store override → default)
 */
export function getRegionCenter(): RegionConfig['center'] {
  return useAppConfigStore.getState().regionCenter ?? DEFAULT_REGION.center;
}

/**
 * Get the effective region bounds (store override → default)
 */
export function getRegionBounds(): RegionConfig['bounds'] {
  return useAppConfigStore.getState().regionBounds ?? DEFAULT_REGION.bounds;
}

export interface RegionBbox {
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * Get the effective region bbox in Overpass API format
 */
export function getRegionBbox(): RegionBbox {
  const bounds = getRegionBounds();
  return {
    south: bounds.minLat,
    north: bounds.maxLat,
    west: bounds.minLon,
    east: bounds.maxLon,
  };
}
