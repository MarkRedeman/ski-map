/**
 * Resolution Control component
 * 
 * Provides buttons to adjust terrain resolution (1x, 2x, 4x, 8x, 16x).
 * Also includes a toggle for showing/hiding peak and place labels.
 * Positioned in the bottom-right corner of the map.
 * Shows a loading spinner when terrain is being fetched.
 */

import { useSettingsStore, type ResolutionLevel } from '@/stores/useSettingsStore'
import { useTerrainStore } from '@/store/terrainStore'
import { useMapStore } from '@/stores/useMapStore'

const RESOLUTION_LEVELS: ResolutionLevel[] = ['1x', '2x', '4x', '8x', '16x']

export function ResolutionControl() {
  const resolution = useSettingsStore((s) => s.resolution)
  const setResolution = useSettingsStore((s) => s.setResolution)
  const isLoading = useTerrainStore((s) => s.isLoading)
  const showLabels = useMapStore((s) => s.showLabels)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  const toggleLayer = useMapStore((s) => s.toggleLayer)

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
      {/* Pistes toggle */}
      <button
        onClick={() => toggleLayer('pistes')}
        className={`
          flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors
          ${showPistes
            ? 'bg-blue-500 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }
        `}
        title={showPistes ? 'Hide pistes' : 'Show pistes'}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 20L12 4l8 16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Pistes</span>
      </button>

      {/* Lifts toggle */}
      <button
        onClick={() => toggleLayer('lifts')}
        className={`
          flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors
          ${showLifts
            ? 'bg-pink-500 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }
        `}
        title={showLifts ? 'Hide lifts' : 'Show lifts'}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M6 8v8M18 8v8M6 6h12" strokeLinecap="round" />
        </svg>
        <span>Lifts</span>
      </button>

      {/* Labels toggle */}
      <button
        onClick={() => toggleLayer('labels')}
        className={`
          flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors
          ${showLabels
            ? 'bg-amber-500 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }
        `}
        title={showLabels ? 'Hide labels' : 'Show labels'}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span>Labels</span>
      </button>

      {/* Separator */}
      <div className="h-4 w-px bg-white/20" />

      {/* Resolution buttons */}
      <div className="flex gap-1">
        {RESOLUTION_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setResolution(level)}
            disabled={isLoading}
            className={`
              rounded px-2 py-1 text-xs font-medium transition-colors
              ${resolution === level
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
              ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
            title={`Set terrain resolution to ${level}`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div className="ml-1">
          <svg
            className="h-4 w-4 animate-spin text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  )
}
