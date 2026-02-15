/**
 * Settings store for app-wide configuration
 *
 * Manages resolution and terrain appearance settings.
 * URL persistence is handled by useURLSync hook.
 */

import { create } from 'zustand';

export type ResolutionLevel = '1x' | '2x' | '4x' | '8x' | '16x';

/** Resolution presets mapping to zoom levels and mesh segments */
const RESOLUTION_PRESETS: Record<ResolutionLevel, { zoom: number; segments: number }> = {
  '1x': { zoom: 11, segments: 128 },
  '2x': { zoom: 12, segments: 256 },
  '4x': { zoom: 13, segments: 512 },
  '8x': { zoom: 14, segments: 512 },
  '16x': { zoom: 15, segments: 512 },
};

/** Default terrain appearance values */
export const DEFAULT_TERRAIN_BRIGHTNESS = 0.6;
export const DEFAULT_TERRAIN_SATURATION = 0.75;

/** Valid range for terrain brightness */
export const TERRAIN_BRIGHTNESS_MIN = 0.3;
export const TERRAIN_BRIGHTNESS_MAX = 1.0;
export const TERRAIN_BRIGHTNESS_STEP = 0.05;

/** Valid range for terrain saturation */
export const TERRAIN_SATURATION_MIN = 0.0;
export const TERRAIN_SATURATION_MAX = 1.0;
export const TERRAIN_SATURATION_STEP = 0.05;

interface SettingsState {
  /** Current resolution level */
  resolution: ResolutionLevel;
  /** Terrain brightness multiplier (0.3 - 1.0, default 0.7) */
  terrainBrightness: number;
  /** Terrain saturation multiplier (0.0 - 1.0, default 0.5) */
  terrainSaturation: number;
  /** Set resolution level */
  setResolution: (res: ResolutionLevel) => void;
  /** Set terrain brightness (clamped to valid range) */
  setTerrainBrightness: (value: number) => void;
  /** Set terrain saturation (clamped to valid range) */
  setTerrainSaturation: (value: number) => void;
  /** Get terrain zoom level for current resolution */
  getTerrainZoom: () => number;
  /** Get mesh segments for current resolution */
  getTerrainSegments: () => number;
}

/** Read initial settings from URL query params (for initial load before useURLSync takes over) */
function getInitialSettings(): {
  resolution: ResolutionLevel;
  terrainBrightness: number;
  terrainSaturation: number;
} {
  if (typeof window === 'undefined') {
    return {
      resolution: '2x',
      terrainBrightness: DEFAULT_TERRAIN_BRIGHTNESS,
      terrainSaturation: DEFAULT_TERRAIN_SATURATION,
    };
  }

  const params = new URLSearchParams(window.location.search);

  // Resolution
  const res = params.get('resolution');
  const resolution = res && res in RESOLUTION_PRESETS ? (res as ResolutionLevel) : '2x';

  // Terrain brightness
  const brightnessStr = params.get('brightness');
  let terrainBrightness = DEFAULT_TERRAIN_BRIGHTNESS;
  if (brightnessStr) {
    const parsed = parseFloat(brightnessStr);
    if (!isNaN(parsed)) {
      terrainBrightness = Math.max(
        TERRAIN_BRIGHTNESS_MIN,
        Math.min(TERRAIN_BRIGHTNESS_MAX, parsed)
      );
    }
  }

  // Terrain saturation
  const saturationStr = params.get('saturation');
  let terrainSaturation = DEFAULT_TERRAIN_SATURATION;
  if (saturationStr) {
    const parsed = parseFloat(saturationStr);
    if (!isNaN(parsed)) {
      terrainSaturation = Math.max(
        TERRAIN_SATURATION_MIN,
        Math.min(TERRAIN_SATURATION_MAX, parsed)
      );
    }
  }

  return { resolution, terrainBrightness, terrainSaturation };
}

const initialSettings = getInitialSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  resolution: initialSettings.resolution,
  terrainBrightness: initialSettings.terrainBrightness,
  terrainSaturation: initialSettings.terrainSaturation,

  setResolution: (resolution) => {
    set({ resolution });
    // URL update is now handled by useURLSync hook
  },

  setTerrainBrightness: (value) => {
    const clamped = Math.max(TERRAIN_BRIGHTNESS_MIN, Math.min(TERRAIN_BRIGHTNESS_MAX, value));
    // Round to avoid floating point drift from slider
    set({ terrainBrightness: Math.round(clamped * 100) / 100 });
  },

  setTerrainSaturation: (value) => {
    const clamped = Math.max(TERRAIN_SATURATION_MIN, Math.min(TERRAIN_SATURATION_MAX, value));
    set({ terrainSaturation: Math.round(clamped * 100) / 100 });
  },

  getTerrainZoom: () => {
    const { resolution } = get();
    return RESOLUTION_PRESETS[resolution].zoom;
  },

  getTerrainSegments: () => {
    const { resolution } = get();
    return RESOLUTION_PRESETS[resolution].segments;
  },
}));

/** Hook to get computed terrain settings */
export function useTerrainSettings() {
  const resolution = useSettingsStore((s) => s.resolution);
  // Return stable reference - RESOLUTION_PRESETS entries are static objects
  return RESOLUTION_PRESETS[resolution];
}
