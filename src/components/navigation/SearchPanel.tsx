import { useState, useMemo } from 'react'
import { MapPin, Navigation, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useNavigationStore, type Location } from '@/stores/useNavigationStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { cn } from '@/lib/utils'

export function SearchPanel() {
  const { 
    fromLocation, 
    toLocation, 
    setFromLocation, 
    setToLocation, 
    swapLocations,
    isCalculating 
  } = useNavigationStore()

  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null)

  // Get available locations from pistes and lifts
  const { data: pistes } = usePistes()
  const { data: lifts } = useLifts()

  const locations = useMemo(() => {
    const locs: Location[] = []
    
    // Add lift stations as locations
    if (lifts) {
      lifts.forEach((lift) => {
        if (lift.stations) {
          lift.stations.forEach((station, i) => {
            locs.push({
              id: `${lift.id}-station-${i}`,
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
            id: `${piste.id}-start`,
            name: `${piste.name} (Start)`,
            type: 'piste_start',
            coordinates: piste.startPoint,
          })
        }
        if (piste.endPoint) {
          locs.push({
            id: `${piste.id}-end`,
            name: `${piste.name} (End)`,
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
  }

  return (
    <div className="space-y-3">
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
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <button
          onClick={swapLocations}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </div>

      {/* Location Suggestions */}
      {activeInput && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleSelectLocation(location)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sky-50 transition-colors"
              >
                <LocationIcon type={location.type} />
                <span>{location.name}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">
              No locations found
            </div>
          )}
        </div>
      )}

      {/* Calculate Route Button */}
      <button
        disabled={!fromLocation || !toLocation || isCalculating}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
          fromLocation && toLocation
            ? 'bg-sky-600 text-white hover:bg-sky-700'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
      return <div className="h-3 w-3 rounded bg-amber-500" />
    case 'piste_start':
      return <div className="h-3 w-3 rounded-full bg-green-500" />
    case 'piste_end':
      return <div className="h-3 w-3 rounded-full bg-red-500" />
    default:
      return <MapPin className="h-3 w-3 text-slate-400" />
  }
}
