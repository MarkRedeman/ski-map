/**
 * InfoPanel component - displays detailed info for selected piste/lift/peak/place
 * Shows when an item is clicked, styled to match the map legend
 */

import { X, Mountain, Ruler, Navigation, MapPin } from 'lucide-react'
import { useMapStore } from '@/stores/useMapStore'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { usePeaks } from '@/hooks/usePeaks'
import { usePlaces } from '@/hooks/usePlaces'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { LIFT_TYPE_CONFIG } from './Lifts'
import { PISTE_DIFFICULTY_CONFIG } from './Pistes'

// Common layout component for all info panels
interface PanelLayoutProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

function PanelLayout({ icon, title, subtitle, onClose, children }: PanelLayoutProps) {
  return (
    <div className="absolute top-4 left-4 z-50 w-72 overflow-hidden rounded-lg bg-black/80 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {icon}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
            {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-white/20 flex-shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
      {children}
    </div>
  )
}

// Piste info panel — fetches its own data
function PisteInfoPanel({ id }: { id: string }) {
  const { data: pistes } = usePistes()
  const clearSelection = useMapStore((s) => s.clearSelection)
  const setDestination = useNavigationStore((s) => s.setDestination)

  const piste = pistes?.find(p => p.id === id)
  if (!piste) return null

  const config = PISTE_DIFFICULTY_CONFIG[piste.difficulty]

  const handleNavigate = () => {
    if (piste.coordinates.length > 0) {
      // Get the last point of the last segment
      const lastSegment = piste.coordinates[piste.coordinates.length - 1]
      const lastCoord = lastSegment?.[lastSegment.length - 1]
      if (lastCoord) {
        setDestination({
          id: piste.id,
          name: piste.name,
          coordinates: [lastCoord[0], lastCoord[1], 0],
          type: 'piste',
        })
      }
    }
    clearSelection()
  }

  return (
    <PanelLayout
      icon={
        <div
          className="h-4 w-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color }}
        />
      }
      title={piste.name}
      subtitle={`${config.label} Piste${piste.ref ? ` #${piste.ref}` : ''}`}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Ruler className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Length</p>
            <p className="text-xs font-medium text-white">{(piste.length / 1000).toFixed(2)} km</p>
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
          onClick={handleNavigate}
          className="flex w-full items-center justify-center gap-2 rounded bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30"
        >
          <Navigation className="h-3.5 w-3.5" />
          Navigate to End
        </button>
      </div>
    </PanelLayout>
  )
}

// Lift info panel — fetches its own data
function LiftInfoPanel({ id }: { id: string }) {
  const { data: lifts } = useLifts()
  const clearSelection = useMapStore((s) => s.clearSelection)
  const setDestination = useNavigationStore((s) => s.setDestination)

  const lift = lifts?.find(l => l.id === id)
  if (!lift) return null

  const config = LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']

  const handleNavigate = () => {
    if (lift.coordinates.length > 0) {
      const lastCoord = lift.coordinates[lift.coordinates.length - 1]
      if (lastCoord) {
        setDestination({
          id: lift.id,
          name: lift.name,
          coordinates: [lastCoord[0], lastCoord[1], 0],
          type: 'lift',
        })
      }
    }
    clearSelection()
  }

  return (
    <PanelLayout
      icon={<span className="text-lg">{config.icon}</span>}
      title={lift.name}
      subtitle={lift.type}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Ruler className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Length</p>
            <p className="text-xs font-medium text-white">{(lift.length / 1000).toFixed(2)} km</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <div
            className="h-4 w-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: config.color }}
          />
          <div>
            <p className="text-[10px] text-white/50">Type</p>
            <p className="text-xs font-medium text-white">{lift.type}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 pt-0">
        <button
          onClick={handleNavigate}
          className="flex w-full items-center justify-center gap-2 rounded bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30"
        >
          <Navigation className="h-3.5 w-3.5" />
          Navigate to Top
        </button>
      </div>
    </PanelLayout>
  )
}

// Peak info panel — fetches its own data
function PeakInfoPanel({ id }: { id: string }) {
  const { data: peaks } = usePeaks()
  const clearSelection = useMapStore((s) => s.clearSelection)

  const peak = peaks?.find(p => p.id === id)
  if (!peak) return null

  return (
    <PanelLayout
      icon={<Mountain className="h-4 w-4 text-amber-400" />}
      title={peak.name}
      subtitle="Mountain Peak"
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <Mountain className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Elevation</p>
            <p className="text-xs font-medium text-white">{peak.elevation?.toLocaleString() ?? 'Unknown'} m</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <MapPin className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Coordinates</p>
            <p className="text-xs font-medium text-white">
              {peak.lat.toFixed(4)}°
            </p>
          </div>
        </div>
      </div>
    </PanelLayout>
  )
}

// Place info panel — fetches its own data
function PlaceInfoPanel({ id }: { id: string }) {
  const { data: places } = usePlaces()
  const clearSelection = useMapStore((s) => s.clearSelection)

  const place = places?.find(p => p.id === id)
  if (!place) return null

  const getPlaceIcon = () => {
    switch (place.type) {
      case 'town': return '🏘️'
      case 'village': return '🏠'
      case 'hamlet': return '🏡'
      default: return '📍'
    }
  }

  const getPlaceTypeLabel = () => {
    switch (place.type) {
      case 'town': return 'Town'
      case 'village': return 'Village'
      case 'hamlet': return 'Hamlet'
      default: return place.type.charAt(0).toUpperCase() + place.type.slice(1)
    }
  }

  return (
    <PanelLayout
      icon={<span className="text-lg">{getPlaceIcon()}</span>}
      title={place.name}
      subtitle={getPlaceTypeLabel()}
      onClose={clearSelection}
    >
      {/* Stats */}
      <div className="p-3">
        <div className="flex items-center gap-2 rounded bg-white/10 p-2">
          <MapPin className="h-4 w-4 text-white/50" />
          <div>
            <p className="text-[10px] text-white/50">Location</p>
            <p className="text-xs font-medium text-white">
              {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E
            </p>
          </div>
        </div>
      </div>
    </PanelLayout>
  )
}

// Main InfoPanel component — delegates to type-specific panels
export function InfoPanel() {
  const selectedEntity = useMapStore((s) => s.selectedEntity)

  if (!selectedEntity) return null

  switch (selectedEntity.type) {
    case 'piste':
      return <PisteInfoPanel id={selectedEntity.id} />
    case 'lift':
      return <LiftInfoPanel id={selectedEntity.id} />
    case 'peak':
      return <PeakInfoPanel id={selectedEntity.id} />
    case 'place':
      return <PlaceInfoPanel id={selectedEntity.id} />
    default:
      return null
  }
}
