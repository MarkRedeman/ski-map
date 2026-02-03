/**
 * InfoPanel component - displays detailed info for selected piste/lift
 * Shows in sidebar when a piste or lift is clicked
 */

import { useMemo } from 'react'
import { X, Mountain, ArrowUp, ArrowDown, Ruler, Users, Navigation } from 'lucide-react'
import { useMapStore } from '@/stores/useMapStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useNavigationStore } from '@/stores/useNavigationStore'

const DIFFICULTY_CONFIG = {
  blue: { label: 'Easy', color: 'text-blue-700', bg: 'bg-blue-100', icon: '🔵' },
  red: { label: 'Intermediate', color: 'text-red-700', bg: 'bg-red-100', icon: '🔴' },
  black: { label: 'Expert', color: 'text-gray-900', bg: 'bg-gray-200', icon: '⚫' },
} as const

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
    const difficulty = DIFFICULTY_CONFIG[selectedPiste.difficulty]
    const length = calculateLength(selectedPiste.coordinates)

    return (
      <div className="absolute bottom-4 left-4 z-50 w-80 overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className={`${difficulty.bg} px-4 py-3`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{difficulty.icon}</span>
              <div>
                <h2 className={`text-lg font-bold ${difficulty.color}`}>{selectedPiste.name}</h2>
                <p className="text-sm text-gray-600">
                  {difficulty.label} Piste
                  {selectedPiste.ref && <span className="ml-2 font-mono">#{selectedPiste.ref}</span>}
                </p>
              </div>
            </div>
            <button
              onClick={clearSelection}
              className="rounded-full p-1 transition-colors hover:bg-white/50"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
            <Ruler className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Length</p>
              <p className="font-semibold text-gray-900">{(length / 1000).toFixed(2)} km</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
            <Mountain className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Difficulty</p>
              <p className="font-semibold text-gray-900">{difficulty.label}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={handleNavigateTo}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-sky-600"
          >
            <Navigation className="h-4 w-4" />
            Navigate to End
          </button>
        </div>
      </div>
    )
  }

  // Render lift info
  if (selectedLift) {
    const length = calculateLength(selectedLift.coordinates)

    return (
      <div className="absolute bottom-4 left-4 z-50 w-80 overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-amber-100 px-4 py-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚡</span>
              <div>
                <h2 className="text-lg font-bold text-amber-800">{selectedLift.name}</h2>
                <p className="text-sm text-gray-600">{selectedLift.type}</p>
              </div>
            </div>
            <button
              onClick={clearSelection}
              className="rounded-full p-1 transition-colors hover:bg-white/50"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
            <Ruler className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Length</p>
              <p className="font-semibold text-gray-900">{(length / 1000).toFixed(2)} km</p>
            </div>
          </div>
          {selectedLift.capacity ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Capacity</p>
                <p className="font-semibold text-gray-900">{selectedLift.capacity}/h</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <ArrowUp className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-semibold text-gray-900">{selectedLift.type}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stations */}
        {selectedLift.stations && selectedLift.stations.length >= 2 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase text-gray-500">Stations</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ArrowDown className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-700">
                  {selectedLift.stations[0]?.name || 'Bottom Station'}
                </span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <ArrowUp className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-700">
                  {selectedLift.stations[1]?.name || 'Top Station'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={handleNavigateTo}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-600"
          >
            <Navigation className="h-4 w-4" />
            Navigate to Top
          </button>
        </div>
      </div>
    )
  }

  return null
}
