import { useState, useMemo, useCallback } from 'react'
import { MapPin, Navigation, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useRoutePlanningStore, type Location } from '@/stores/useNavigationStore'
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useRouteCalculation } from '@/hooks/useRoute'
import { cn } from '@/lib/utils'

export function SearchPanel() {
  const fromLocation = useRoutePlanningStore((s) => s.fromLocation)
  const toLocation = useRoutePlanningStore((s) => s.toLocation)
  const setFromLocation = useRoutePlanningStore((s) => s.setFromLocation)
  const setToLocation = useRoutePlanningStore((s) => s.setToLocation)
  const swapLocations = useRoutePlanningStore((s) => s.swapLocations)
  const isCalculating = useRoutePlanningStore((s) => s.isCalculating)
  const setIsCalculating = useRoutePlanningStore((s) => s.setIsCalculating)
  const setSelectedRoute = useRoutePlanningStore((s) => s.setSelectedRoute)
  const { enabledDifficulties } = useDifficultyFilter()

  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  // Get available locations from pistes and lifts
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()

  // Route calculation
  const { isReady, calculate } = useRouteCalculation()

  const locations = useMemo(() => {
    const locs: Location[] = []
    
    // Add lift stations as locations
    if (lifts) {
      lifts.forEach((lift) => {
        if (lift.stations) {
          lift.stations.forEach((station, i) => {
            locs.push({
              id: `lift_station-${lift.id}-${i}`,
              name: station.name || `${lift.name} ${i === 0 ? 'Bottom' : 'Top'}`,
              type: 'lift_station',
              coordinates: station.coordinates,
            })
          })
        }
      })
    }

    // Add piste start/end points
    if (pistes) {
      pistes.forEach((piste) => {
        if (piste.startPoint) {
          locs.push({
            id: `piste_start-${piste.id}`,
            name: `${piste.name} (Top)`,
            type: 'piste_start',
            coordinates: piste.startPoint,
          })
        }
        if (piste.endPoint) {
          locs.push({
            id: `piste_end-${piste.id}`,
            name: `${piste.name} (Bottom)`,
            type: 'piste_end',
            coordinates: piste.endPoint,
          })
        }
      })
    }

    return locs
  }, [pistes, lifts])

  const filteredLocations = useMemo(() => {
    const query = activeInput === 'from' ? fromQuery : toQuery
    if (!query.trim()) return locations.slice(0, 10)
    
    const lowerQuery = query.toLowerCase()
    return locations
      .filter((loc) => loc.name.toLowerCase().includes(lowerQuery))
      .slice(0, 10)
  }, [locations, fromQuery, toQuery, activeInput])

  const handleSelectLocation = (location: Location) => {
    if (activeInput === 'from') {
      setFromLocation(location)
      setFromQuery(location.name)
    } else {
      setToLocation(location)
      setToQuery(location.name)
    }
    setActiveInput(null)
    setRouteError(null)
  }

  const handleGetDirections = useCallback(() => {
    if (!fromLocation || !toLocation || !calculate) return

    setIsCalculating(true)
    setRouteError(null)
    setSelectedRoute(null)

    // Use setTimeout to allow UI to update before computation
    setTimeout(() => {
      try {
        const route = calculate(fromLocation, toLocation, enabledDifficulties)
        
        if (route) {
          setSelectedRoute(route)
        } else {
          setRouteError('No route found. Try enabling more difficulty levels or choosing different locations.')
        }
      } catch (error) {
        console.error('Route calculation error:', error)
        setRouteError('Failed to calculate route. Please try again.')
      } finally {
        setIsCalculating(false)
      }
    }, 50)
  }, [fromLocation, toLocation, calculate, enabledDifficulties, setIsCalculating, setSelectedRoute])

  const canCalculate = fromLocation && toLocation && isReady && !isCalculating

  return (
    <div className="space-y-2">
      {/* From Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <input
          type="text"
          placeholder="From (e.g., Gaislachkogl)"
          value={fromLocation ? fromLocation.name : fromQuery}
          onChange={(e) => {
            setFromQuery(e.target.value)
            if (fromLocation) setFromLocation(null)
          }}
          onFocus={() => setActiveInput('from')}
          className="w-full rounded bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <button
          onClick={swapLocations}
          className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          title="Swap locations"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
      </div>

      {/* To Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <MapPin className="h-4 w-4 text-red-500" />
        </div>
        <input
          type="text"
          placeholder="To (e.g., Giggijoch)"
          value={toLocation ? toLocation.name : toQuery}
          onChange={(e) => {
            setToQuery(e.target.value)
            if (toLocation) setToLocation(null)
          }}
          onFocus={() => setActiveInput('to')}
          className="w-full rounded bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {/* Location Suggestions */}
      {activeInput && (
        <div className="rounded bg-black/80 backdrop-blur-sm max-h-48 overflow-y-auto border border-white/10">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleSelectLocation(location)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LocationIcon type={location.type} />
                <span className="truncate">{location.name}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-white/40">
              No locations found
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {routeError && (
        <div className="rounded bg-red-500/20 px-3 py-2 text-xs text-red-300">
          {routeError}
        </div>
      )}

      {/* Calculate Route Button */}
      <button
        onClick={handleGetDirections}
        disabled={!canCalculate}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded py-2 text-sm font-medium transition-all',
          canCalculate
            ? 'bg-sky-500 text-white hover:bg-sky-600'
            : 'bg-white/10 text-white/30 cursor-not-allowed'
        )}
      >
        {isCalculating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4" />
            Get Directions
          </>
        )}
      </button>
    </div>
  )
}

function LocationIcon({ type }: { type: Location['type'] }) {
  switch (type) {
    case 'lift_station':
      return <div className="h-3 w-3 rounded bg-amber-500 flex-shrink-0" />
    case 'piste_start':
      return <div className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0" />
    case 'piste_end':
      return <div className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0" />
    default:
      return <MapPin className="h-3 w-3 text-white/40 flex-shrink-0" />
  }
}
