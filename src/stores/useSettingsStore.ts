/**
 * Settings store for app-wide configuration
 * 
 * Manages resolution settings and persists to URL query parameters
 */

import { create } from 'zustand'

export type ResolutionLevel = '1x' | '2x' | '4x' | '8x' | '16x'

/** Resolution presets mapping to zoom levels and mesh segments */
const RESOLUTION_PRESETS: Record<ResolutionLevel, { zoom: number; segments: number }> = {
  '1x': { zoom: 11, segments: 128 },
  '2x': { zoom: 12, segments: 256 },
  '4x': { zoom: 13, segments: 512 },
  '8x': { zoom: 14, segments: 512 },
  '16x': { zoom: 15, segments: 512 },
}

interface SettingsState {
  /** Current resolution level */
  resolution: ResolutionLevel
  /** Set resolution level */
  setResolution: (res: ResolutionLevel) => void
  /** Get terrain zoom level for current resolution */
  getTerrainZoom: () => number
  /** Get mesh segments for current resolution */
  getTerrainSegments: () => number
}

/** Read initial resolution from URL query params */
function getInitialResolution(): ResolutionLevel {
  if (typeof window === 'undefined') return '2x'
  
  const params = new URLSearchParams(window.location.search)
  const res = params.get('resolution')
  
  if (res && res in RESOLUTION_PRESETS) {
    return res as ResolutionLevel
  }
  
  return '2x' // Default
}

/** Update URL query param without page reload */
function updateUrlParam(resolution: ResolutionLevel) {
  if (typeof window === 'undefined') return
  
  const url = new URL(window.location.href)
  
  if (resolution === '2x') {
    // Remove param if default
    url.searchParams.delete('resolution')
  } else {
    url.searchParams.set('resolution', resolution)
  }
  
  window.history.replaceState({}, '', url.toString())
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  resolution: getInitialResolution(),
  
  setResolution: (resolution) => {
    set({ resolution })
    updateUrlParam(resolution)
  },
  
  getTerrainZoom: () => {
    const { resolution } = get()
    return RESOLUTION_PRESETS[resolution].zoom
  },
  
  getTerrainSegments: () => {
    const { resolution } = get()
    return RESOLUTION_PRESETS[resolution].segments
  },
}))

/** Hook to get computed terrain settings */
export function useTerrainSettings() {
  const resolution = useSettingsStore((s) => s.resolution)
  // Return stable reference - RESOLUTION_PRESETS entries are static objects
  return RESOLUTION_PRESETS[resolution]
}
