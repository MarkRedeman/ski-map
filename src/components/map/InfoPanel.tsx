/**
 * InfoPanel component - displays detailed info for selected piste/lift
 * Shows when a piste or lift is clicked, styled to match the map legend
 */

import { useMemo } from 'react'
import { X, Mountain, Ruler, Users, Navigation, ArrowUp, ArrowDown } from 'lucide-react'
import { useMapStore } from '@/stores/useMapStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { LIFT_TYPE_CONFIG } from './Lifts'
import { PISTE_DIFFICULTY_CONFIG } from './Pistes'

/**
 * Calculate approximate length from coordinates in meters
 */
function calculateLength(coordinates: [number, number][]): number {
  let length = 0
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!
    const [lon2, lat2] = coordinates[i]!
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    length += 6371000 * c
  }
  return length
}

export function InfoPanel() {
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const setDestination = useNavigationStore((s) => s.setDestination)
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()

  // Find selected piste
  const selectedPiste = useMemo(() => {
    if (!selectedPisteId || !pistes) return null
    return pistes.find((p) => p.id === selectedPisteId) ?? null
  }, [selectedPisteId, pistes])

  // Find selected lift
  const selectedLift = useMemo(() => {
    if (!selectedLiftId || !lifts) return null
    return lifts.find((l) => l.id === selectedLiftId) ?? null
  }, [selectedLiftId, lifts])

  if (!selectedPiste && !selectedLift) return null

  // Handle navigate to
  const handleNavigateTo = () => {
    if (selectedPiste?.endPoint) {
      setDestination({
        id: selectedPiste.id,
        name: selectedPiste.name,
        coordinates: selectedPiste.endPoint,
        type: 'piste',
      })
    } else if (selectedLift?.stations?.[1]) {
      setDestination({
        id: selectedLift.id,
        name: selectedLift.name,
        coordinates: selectedLift.stations[1].coordinates,
        type: 'lift',
      })
    }
    clearSelection()
  }

  // Render piste info
  if (selectedPiste) {
    const config = PISTE_DIFFICULTY_CONFIG[selectedPiste.difficulty]
    const length = calculateLength(selectedPiste.coordinates)

    return (
      <div className="absolute top-4 left-4 z-50 w-72 overflow-hidden rounded-lg bg-black/80 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">{selectedPiste.name}</h2>
              <p className="text-xs text-white/60">
                {config.label} Piste
                {selectedPiste.ref && <span className="ml-1 font-mono">#{selectedPiste.ref}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={clearSelection}
            className="rounded p-1 transition-colors hover:bg-white/20 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <Ruler className="h-4 w-4 text-white/50" />
            <div>
              <p className="text-[10px] text-white/50">Length</p>
              <p className="text-xs font-medium text-white">{(length / 1000).toFixed(2)} km</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <Mountain className="h-4 w-4 text-white/50" />
            <div>
              <p className="text-[10px] text-white/50">Difficulty</p>
              <p className="text-xs font-medium text-white">{config.label}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 pt-0">
          <button
            onClick={handleNavigateTo}
            className="flex w-full items-center justify-center gap-2 rounded bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30"
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigate to End
          </button>
        </div>
      </div>
    )
  }

  // Render lift info
  if (selectedLift) {
    const config = LIFT_TYPE_CONFIG[selectedLift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']
    const length = calculateLength(selectedLift.coordinates)

    return (
      <div className="absolute top-4 left-4 z-50 w-72 overflow-hidden rounded-lg bg-black/80 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">{selectedLift.name}</h2>
              <p className="text-xs text-white/60">{selectedLift.type}</p>
            </div>
          </div>
          <button
            onClick={clearSelection}
            className="rounded p-1 transition-colors hover:bg-white/20 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="flex items-center gap-2 rounded bg-white/10 p-2">
            <Ruler className="h-4 w-4 text-white/50" />
            <div>
              <p className="text-[10px] text-white/50">Length</p>
              <p className="text-xs font-medium text-white">{(length / 1000).toFixed(2)} km</p>
            </div>
          </div>
          {selectedLift.capacity ? (
            <div className="flex items-center gap-2 rounded bg-white/10 p-2">
              <Users className="h-4 w-4 text-white/50" />
              <div>
                <p className="text-[10px] text-white/50">Capacity</p>
                <p className="text-xs font-medium text-white">{selectedLift.capacity}/h</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded bg-white/10 p-2">
              <div
                className="h-4 w-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <div>
                <p className="text-[10px] text-white/50">Type</p>
                <p className="text-xs font-medium text-white">{selectedLift.type}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stations */}
        {selectedLift.stations && selectedLift.stations.length >= 2 && (
          <div className="px-3 pb-3">
            <div className="rounded bg-white/10 p-2">
              <p className="text-[10px] text-white/50 mb-1.5">Stations</p>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3 text-green-400" />
                  <span className="text-white/80 truncate max-w-[80px]">
                    {selectedLift.stations[0]?.name || 'Bottom'}
                  </span>
                </div>
                <div className="h-px flex-1 bg-white/20" />
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-red-400" />
                  <span className="text-white/80 truncate max-w-[80px]">
                    {selectedLift.stations[1]?.name || 'Top'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 pt-0">
          <button
            onClick={handleNavigateTo}
            className="flex w-full items-center justify-center gap-2 rounded bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30"
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigate to Top
          </button>
        </div>
      </div>
    )
  }

  return null
}
