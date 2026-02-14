/**
 * Resolution Control component - Collapsible control panel
 * 
 * Provides buttons to adjust terrain resolution (1x, 2x, 4x, 8x, 16x).
 * Also includes a toggle for showing/hiding peak and place labels.
 * Positioned in the bottom-right corner of the map.
 * Shows a loading spinner when terrain is being fetched.
 * Includes a "locate me" button when location tracking is active.
 * 
 * On mobile, collapses to show only current resolution.
 */

import { Navigation, ChevronUp, ChevronDown, Settings2 } from 'lucide-react'
import { useSettingsStore, type ResolutionLevel } from '@/stores/useSettingsStore'
import { useMapStore } from '@/stores/useMapStore'
import { useRoutePlanningStore } from '@/stores/useNavigationStore'
import { useUIStore } from '@/stores/useUIStore'
import { geoToLocal } from '@/lib/geo/coordinates'

const RESOLUTION_LEVELS: ResolutionLevel[] = ['1x', '2x', '4x', '8x', '16x']

export function ResolutionControl() {
  const resolution = useSettingsStore((s) => s.resolution)
  const setResolution = useSettingsStore((s) => s.setResolution)
  const isLoading = useMapStore((s) => s.isLoadingTerrain)
  const showLabels = useMapStore((s) => s.showLabels)
  const showPistes = useMapStore((s) => s.showPistes)
  const showLifts = useMapStore((s) => s.showLifts)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  
  const userLocation = useRoutePlanningStore((s) => s.userLocation)
  const isTrackingLocation = useRoutePlanningStore((s) => s.isTrackingLocation)
  
  const controlsExpanded = useUIStore((s) => s.controlsExpanded)
  const toggleControls = useUIStore((s) => s.toggleControls)

  const handleLocateMe = () => {
    if (!userLocation) return
    
    const [lat, lon, elevation] = userLocation
    const [x, y, z] = geoToLocal(lat, lon, elevation)
    
    setCameraFocusTarget({
      position: [x, y, z],
      distance: 150,
    })
  }

  // Collapsed state - show compact button with current resolution
  if (!controlsExpanded) {
    return (
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        {/* Locate me button - always visible when tracking (even collapsed) */}
        {isTrackingLocation && userLocation && (
          <button
            onClick={handleLocateMe}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title="Center map on my location"
          >
            <Navigation className="h-4 w-4" />
          </button>
        )}
        
        <button
          onClick={toggleControls}
          className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm transition-all hover:bg-black/80"
          title="Expand controls"
        >
          <Settings2 className="h-4 w-4 text-white" />
          <span className="text-xs font-medium text-white">{resolution}</span>
          {isLoading && (
            <svg
              className="h-3 w-3 animate-spin text-blue-400"
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
          )}
          <ChevronUp className="h-3 w-3 text-white/60" />
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
      {/* Header with collapse button */}
      <button
        onClick={toggleControls}
        className="flex items-center justify-between gap-2 text-white/60 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs font-semibold">Controls</span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </button>
      
      <div className="h-px bg-white/20" />
      
      {/* Main controls row */}
      <div className="flex items-center gap-3">
        {/* Locate me button - only visible when tracking */}
        {isTrackingLocation && userLocation && (
          <>
            <button
              onClick={handleLocateMe}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors bg-blue-500 text-white hover:bg-blue-600"
              title="Center map on my location"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Find Me</span>
            </button>
            
            {/* Separator */}
            <div className="h-4 w-px bg-white/20" />
          </>
        )}

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
      </div>
      
      <div className="h-px bg-white/20" />

      {/* Resolution row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-white/60 uppercase">Quality</span>
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
    </div>
  )
}
