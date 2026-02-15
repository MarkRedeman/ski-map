/**
 * TerrainSettings component
 *
 * Controls for terrain appearance (brightness, saturation).
 * Designed to be easily extracted into a standalone Settings panel later.
 */

import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  TERRAIN_BRIGHTNESS_MIN,
  TERRAIN_BRIGHTNESS_MAX,
  TERRAIN_BRIGHTNESS_STEP,
  TERRAIN_SATURATION_MIN,
  TERRAIN_SATURATION_MAX,
  TERRAIN_SATURATION_STEP,
} from '@/stores/useSettingsStore';

/**
 * Terrain appearance settings (brightness & saturation sliders)
 *
 * Self-contained component that reads/writes to useSettingsStore.
 * Can be placed in any panel - designed for easy relocation to a
 * future Settings panel.
 */
export function TerrainSettings() {
  const terrainBrightness = useSettingsStore((s) => s.terrainBrightness);
  const setTerrainBrightness = useSettingsStore((s) => s.setTerrainBrightness);
  const terrainSaturation = useSettingsStore((s) => s.terrainSaturation);
  const setTerrainSaturation = useSettingsStore((s) => s.setTerrainSaturation);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-white">Terrain</span>

      {/* Brightness slider */}
      <div className="flex items-center gap-2">
        <label className="w-16 text-[11px] text-white/60">Brightness</label>
        <input
          type="range"
          min={TERRAIN_BRIGHTNESS_MIN}
          max={TERRAIN_BRIGHTNESS_MAX}
          step={TERRAIN_BRIGHTNESS_STEP}
          value={terrainBrightness}
          onChange={(e) => setTerrainBrightness(parseFloat(e.target.value))}
          className="terrain-slider h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20"
          title={`Terrain brightness: ${Math.round(terrainBrightness * 100)}%`}
        />
        <span className="w-8 text-right text-[10px] font-medium text-white/50">
          {Math.round(terrainBrightness * 100)}%
        </span>
      </div>

      {/* Saturation slider */}
      <div className="flex items-center gap-2">
        <label className="w-16 text-[11px] text-white/60">Saturation</label>
        <input
          type="range"
          min={TERRAIN_SATURATION_MIN}
          max={TERRAIN_SATURATION_MAX}
          step={TERRAIN_SATURATION_STEP}
          value={terrainSaturation}
          onChange={(e) => setTerrainSaturation(parseFloat(e.target.value))}
          className="terrain-slider h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20"
          title={`Terrain saturation: ${Math.round(terrainSaturation * 100)}%`}
        />
        <span className="w-8 text-right text-[10px] font-medium text-white/50">
          {Math.round(terrainSaturation * 100)}%
        </span>
      </div>
    </div>
  );
}
