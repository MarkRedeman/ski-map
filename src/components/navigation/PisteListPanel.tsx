/**
 * PisteListPanel - Sidebar panel for browsing and selecting pistes/lifts/peaks/villages
 * 
 * Features:
 * - Tabs to switch between Pistes, Lifts, Peaks, and Villages
 * - Difficulty filter chips (for pistes)
 * - Search input for filtering by name
 * - Grouping by ski area with collapsible sections (pistes/lifts)
 * - Scrollable list with hover → highlight in 3D view
 * - Click → select, show info panel, and navigate camera
 * - URL-based selection for shareable links
 */

import { useState, useMemo, useCallback } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { usePistes, groupPistesBySkiArea } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { usePeaks } from '@/hooks/usePeaks'
import { usePlaces } from '@/hooks/usePlaces'
import { useMapStore, ALL_LIFT_TYPES, type LiftType } from '@/stores/useMapStore'
import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { LIFT_TYPE_CONFIG } from '@/components/map/Lifts'
import { geoToLocal } from '@/lib/geo/coordinates'
import type { Piste, Lift, Peak, Place } from '@/lib/api/overpass'
import type { SearchParams } from '@/lib/url/searchSchema'

type Tab = 'pistes' | 'lifts' | 'peaks' | 'villages'

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

// Camera distances for different item types (higher = further away)
const CAMERA_DISTANCES = {
  piste: 800,    // Far enough to see the full piste
  lift: 700,     // Good distance to see lift line
  peak: 600,     // Moderate distance to appreciate the peak
  place: 640,    // Good distance to see the village area
}

/**
 * Calculate approximate length from single-segment coordinates in meters
 */
function calculateSegmentLength(coordinates: [number, number][]): number {
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

/**
 * Calculate total length of all segments in a multi-segment piste
 */
function calculateTotalLength(segments: [number, number][][]): number {
  return segments.reduce((total, seg) => total + calculateSegmentLength(seg), 0)
}

/**
 * Calculate center position of a piste (average of all coordinates)
 */
function getPisteCenter(piste: Piste): [number, number, number] {
  const allCoords = piste.coordinates.flat()
  if (allCoords.length === 0) return [0, 0, 0]
  
  let sumLon = 0, sumLat = 0
  for (const [lon, lat] of allCoords) {
    sumLon += lon
    sumLat += lat
  }
  const avgLon = sumLon / allCoords.length
  const avgLat = sumLat / allCoords.length
  
  return geoToLocal(avgLat, avgLon, 0)
}

/**
 * Calculate center position of a lift (average of all coordinates)
 */
function getLiftCenter(lift: Lift): [number, number, number] {
  if (lift.coordinates.length === 0) return [0, 0, 0]
  
  let sumLon = 0, sumLat = 0
  for (const [lon, lat] of lift.coordinates) {
    sumLon += lon
    sumLat += lat
  }
  const avgLon = sumLon / lift.coordinates.length
  const avgLat = sumLat / lift.coordinates.length
  
  return geoToLocal(avgLat, avgLon, 0)
}

export function PisteListPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('pistes')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Use global stores for filters (synced with MapLegend)
  const enabledDifficulties = useNavigationStore((s) => s.enabledDifficulties)
  const toggleDifficulty = useNavigationStore((s) => s.toggleDifficulty)
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const toggleLiftType = useMapStore((s) => s.toggleLiftType)

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'pistes': return 'Search pistes...'
      case 'lifts': return 'Search lifts...'
      case 'peaks': return 'Search peaks...'
      case 'villages': return 'Search villages...'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('pistes')}
          className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === 'pistes'
              ? 'border-b-2 border-blue-400 text-blue-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Pistes
        </button>
        <button
          onClick={() => setActiveTab('lifts')}
          className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === 'lifts'
              ? 'border-b-2 border-amber-400 text-amber-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Lifts
        </button>
        <button
          onClick={() => setActiveTab('peaks')}
          className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === 'peaks'
              ? 'border-b-2 border-purple-400 text-purple-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Peaks
        </button>
        <button
          onClick={() => setActiveTab('villages')}
          className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === 'villages'
              ? 'border-b-2 border-orange-400 text-orange-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Villages
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-white/10">
        <input
          type="text"
          placeholder={getPlaceholder()}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {/* Difficulty Filters (only for pistes) */}
      {activeTab === 'pistes' && (
        <div className="flex gap-1.5 p-3 border-b border-white/10">
          {(['blue', 'red', 'black'] as Difficulty[]).map((difficulty) => {
            const isEnabled = enabledDifficulties.has(difficulty)
            return (
              <button
                key={difficulty}
                onClick={() => toggleDifficulty(difficulty)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  isEnabled
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: DIFFICULTY_COLORS[difficulty], opacity: isEnabled ? 1 : 0.4 }}
                />
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </button>
            )
          })}
        </div>
      )}

      {/* Lift Type Filters (only for lifts) */}
      {activeTab === 'lifts' && (
        <div className="flex flex-wrap gap-1.5 p-3 border-b border-white/10">
          {ALL_LIFT_TYPES.map((liftType) => {
            const isEnabled = visibleLiftTypes.has(liftType)
            const config = LIFT_TYPE_CONFIG[liftType as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']
            return (
              <button
                key={liftType}
                onClick={() => toggleLiftType(liftType)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all ${
                  isEnabled
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <span className="text-xs">{config.icon}</span>
                <span className="hidden sm:inline">{liftType}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* List Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'pistes' && (
          <PisteList
            searchQuery={searchQuery}
            enabledDifficulties={enabledDifficulties}
          />
        )}
        {activeTab === 'lifts' && <LiftList searchQuery={searchQuery} visibleLiftTypes={visibleLiftTypes} />}
        {activeTab === 'peaks' && <PeakList searchQuery={searchQuery} />}
        {activeTab === 'villages' && <PlaceList searchQuery={searchQuery} />}
      </div>
    </div>
  )
}

interface PisteListProps {
  searchQuery: string
  enabledDifficulties: Set<Difficulty>
}

function PisteList({ searchQuery, enabledDifficulties }: PisteListProps) {
  const { data: pistes, isLoading } = usePistes()
  const hoveredPisteId = useMapStore((s) => s.getHoveredId('piste'))
  const selectedPisteId = useMapStore((s) => s.getSelectedId('piste'))
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  const setHoveredSkiArea = useMapStore((s) => s.setHoveredSkiArea)
  
  // Get current search params to preserve other params when selecting
  const currentSearch = useSearch({ strict: false }) as SearchParams
  
  // Track collapsed ski areas
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set())

  // Filter and group pistes
  const groupedPistes = useMemo(() => {
    if (!pistes) return []
    
    // First filter by difficulty and search
    const filtered = pistes
      .filter((piste) => enabledDifficulties.has(piste.difficulty))
      .filter((piste) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
          piste.name.toLowerCase().includes(query) ||
          piste.ref?.toLowerCase().includes(query) ||
          piste.skiArea?.name.toLowerCase().includes(query)
        )
      })
    
    // Then group by ski area
    return groupPistesBySkiArea(filtered)
  }, [pistes, enabledDifficulties, searchQuery])

  const toggleArea = (areaId: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }

  // Generate Link search params for a piste
  const getSelectSearch = useCallback((piste: Piste) => {
    const pisteOsmId = piste.id.replace('piste-', '')
    return {
      ...currentSearch,
      select: `piste:${pisteOsmId}`,
    }
  }, [currentSearch])

  // Handle camera focus when clicking (Link handles selection)
  const handleCameraFocus = useCallback((piste: Piste) => {
    const position = getPisteCenter(piste)
    setCameraFocusTarget({ position, distance: CAMERA_DISTANCES.piste })
  }, [setCameraFocusTarget])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-blue-400 rounded-full" />
        <span className="ml-2 text-sm">Loading pistes...</span>
      </div>
    )
  }

  const totalPistes = groupedPistes.reduce((sum, g) => sum + g.pistes.length, 0)

  if (totalPistes === 0) {
    return (
      <div className="p-8 text-center text-sm text-white/40">
        No pistes found
      </div>
    )
  }

  // Check if we have multiple ski areas
  const hasMultipleAreas = groupedPistes.length > 1

  return (
    <>
      {groupedPistes.map(({ skiArea, pistes: areaPistes }) => {
        const areaId = skiArea?.id ?? 'unknown'
        const areaName = skiArea?.name ?? 'Other Pistes'
        const isCollapsed = collapsedAreas.has(areaId)
        
        return (
          <div key={areaId}>
            {/* Ski Area Header - only show if multiple areas */}
            {hasMultipleAreas && (
              <button
                onClick={() => toggleArea(areaId)}
                onMouseEnter={() => setHoveredSkiArea(areaId)}
                onMouseLeave={() => setHoveredSkiArea(null)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border-b border-white/10 transition-colors"
              >
                <span className="text-white/60 text-xs">
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/70 flex-1 text-left">
                  {areaName}
                </span>
                <span className="text-xs text-white/40">
                  {areaPistes.length} pistes
                </span>
              </button>
            )}
            
            {/* Piste Items */}
            {!isCollapsed && areaPistes.map((piste) => (
              <PisteListItem
                key={piste.id}
                piste={piste}
                isHovered={hoveredPisteId === piste.id}
                isSelected={selectedPisteId === piste.id}
                onHover={(id) => setHoveredEntity('piste', id)}
                searchParams={getSelectSearch(piste)}
                onCameraFocus={() => handleCameraFocus(piste)}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}

interface PisteListItemProps {
  piste: Piste
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  searchParams: SearchParams
  onCameraFocus: () => void
}

function PisteListItem({ piste, isHovered, isSelected, onHover, searchParams, onCameraFocus }: PisteListItemProps) {
  // Use pre-calculated length if available, otherwise calculate from multi-segment coordinates
  const length = piste.length ?? calculateTotalLength(piste.coordinates)

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(piste.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected
          ? 'bg-white/20'
          : isHovered
          ? 'bg-white/10'
          : 'hover:bg-white/10'
      }`}
    >
      {/* Difficulty indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: DIFFICULTY_COLORS[piste.difficulty] }}
      />

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {piste.name}
          </span>
          {piste.ref && piste.ref !== piste.name && (
            <span className="text-xs text-white/40">#{piste.ref}</span>
          )}
        </div>
        <div className="text-xs text-white/40">
          {(length / 1000).toFixed(1)} km
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
      )}
    </Link>
  )
}

interface LiftListProps {
  searchQuery: string
  visibleLiftTypes: Set<LiftType>
}

function LiftList({ searchQuery, visibleLiftTypes }: LiftListProps) {
  const { data: lifts, isLoading } = useLifts()
  const hoveredLiftId = useMapStore((s) => s.getHoveredId('lift'))
  const selectedLiftId = useMapStore((s) => s.getSelectedId('lift'))
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  
  // Get current search params to preserve other params when selecting
  const currentSearch = useSearch({ strict: false }) as SearchParams

  const filteredLifts = useMemo(() => {
    if (!lifts) return []
    
    return lifts
      .filter((lift) => visibleLiftTypes.has(lift.type as LiftType))
      .filter((lift) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return lift.name.toLowerCase().includes(query)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [lifts, searchQuery, visibleLiftTypes])

  // Generate Link search params for a lift
  const getSelectSearch = useCallback((lift: Lift) => {
    const liftOsmId = lift.id.replace('lift-', '')
    return {
      ...currentSearch,
      select: `lift:${liftOsmId}`,
    }
  }, [currentSearch])

  // Handle camera focus when clicking
  const handleCameraFocus = useCallback((lift: Lift) => {
    const position = getLiftCenter(lift)
    setCameraFocusTarget({ position, distance: CAMERA_DISTANCES.lift })
  }, [setCameraFocusTarget])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-amber-400 rounded-full" />
        <span className="ml-2 text-sm">Loading lifts...</span>
      </div>
    )
  }

  if (filteredLifts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-white/40">
        No lifts found
      </div>
    )
  }

  return (
    <>
      {filteredLifts.map((lift) => (
        <LiftListItem
          key={lift.id}
          lift={lift}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
          onHover={(id) => setHoveredEntity('lift', id)}
          searchParams={getSelectSearch(lift)}
          onCameraFocus={() => handleCameraFocus(lift)}
        />
      ))}
    </>
  )
}

interface LiftListItemProps {
  lift: Lift
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  searchParams: SearchParams
  onCameraFocus: () => void
}

function LiftListItem({ lift, isHovered, isSelected, onHover, searchParams, onCameraFocus }: LiftListItemProps) {
  const length = useMemo(() => calculateSegmentLength(lift.coordinates), [lift.coordinates])
  const config = LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(lift.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected
          ? 'bg-white/20'
          : isHovered
          ? 'bg-white/10'
          : 'hover:bg-white/10'
      }`}
    >
      {/* Lift type icon */}
      <div
        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}30` }}
      >
        <span className="text-sm">{config.icon}</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {lift.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{lift.type}</span>
          <span>•</span>
          <span>{(length / 1000).toFixed(1)} km</span>
          {lift.capacity && (
            <>
              <span>•</span>
              <span>{lift.capacity}/h</span>
            </>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
      )}
    </Link>
  )
}

interface PeakListProps {
  searchQuery: string
}

function PeakList({ searchQuery }: PeakListProps) {
  const { data: peaks, isLoading } = usePeaks()
  const hoveredPeakId = useMapStore((s) => s.getHoveredId('peak'))
  const selectedPeakId = useMapStore((s) => s.getSelectedId('peak'))
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  
  // Get current search params to preserve other params when selecting
  const currentSearch = useSearch({ strict: false }) as SearchParams

  const filteredPeaks = useMemo(() => {
    if (!peaks) return []
    
    return peaks
      .filter((peak) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return peak.name.toLowerCase().includes(query)
      })
      // Sort by elevation descending (highest first)
      .sort((a, b) => b.elevation - a.elevation)
  }, [peaks, searchQuery])

  // Generate Link search params for a peak
  const getSelectSearch = useCallback((peak: Peak) => {
    const peakOsmId = peak.id.replace('peak-', '')
    return {
      ...currentSearch,
      select: `peak:${peakOsmId}`,
    }
  }, [currentSearch])

  // Handle camera focus when clicking
  const handleCameraFocus = useCallback((peak: Peak) => {
    const position = geoToLocal(peak.lat, peak.lon, peak.elevation)
    setCameraFocusTarget({ position, distance: CAMERA_DISTANCES.peak })
  }, [setCameraFocusTarget])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-purple-400 rounded-full" />
        <span className="ml-2 text-sm">Loading peaks...</span>
      </div>
    )
  }

  if (filteredPeaks.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-white/40">
        No peaks found
      </div>
    )
  }

  return (
    <>
      {filteredPeaks.map((peak) => (
        <PeakListItem
          key={peak.id}
          peak={peak}
          isHovered={hoveredPeakId === peak.id}
          isSelected={selectedPeakId === peak.id}
          onHover={(id) => setHoveredEntity('peak', id)}
          searchParams={getSelectSearch(peak)}
          onCameraFocus={() => handleCameraFocus(peak)}
        />
      ))}
    </>
  )
}

interface PeakListItemProps {
  peak: Peak
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  searchParams: SearchParams
  onCameraFocus: () => void
}

function PeakListItem({ peak, isHovered, isSelected, onHover, searchParams, onCameraFocus }: PeakListItemProps) {
  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(peak.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected
          ? 'bg-white/20'
          : isHovered
          ? 'bg-white/10'
          : 'hover:bg-white/10'
      }`}
    >
      {/* Peak icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-purple-500/20">
        <span className="text-sm">⛰️</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {peak.name}
        </div>
        <div className="text-xs text-white/40">
          {peak.elevation.toLocaleString()} m
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
      )}
    </Link>
  )
}

interface PlaceListProps {
  searchQuery: string
}

function PlaceList({ searchQuery }: PlaceListProps) {
  const { data: places, isLoading } = usePlaces()
  const hoveredPlaceId = useMapStore((s) => s.getHoveredId('place'))
  const selectedPlaceId = useMapStore((s) => s.getSelectedId('place'))
  const setHoveredEntity = useMapStore((s) => s.setHoveredEntity)
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget)
  
  // Get current search params to preserve other params when selecting
  const currentSearch = useSearch({ strict: false }) as SearchParams

  const filteredPlaces = useMemo(() => {
    if (!places) return []
    
    return places
      .filter((place) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return place.name.toLowerCase().includes(query)
      })
      // Sort: towns first, then villages, then hamlets
      .sort((a, b) => {
        const typeOrder = { town: 0, village: 1, hamlet: 2 }
        const orderDiff = typeOrder[a.type] - typeOrder[b.type]
        if (orderDiff !== 0) return orderDiff
        return a.name.localeCompare(b.name)
      })
  }, [places, searchQuery])

  // Generate Link search params for a place
  const getSelectSearch = useCallback((place: Place) => {
    const placeOsmId = place.id.replace('place-', '')
    return {
      ...currentSearch,
      select: `place:${placeOsmId}`,
    }
  }, [currentSearch])

  // Handle camera focus when clicking
  const handleCameraFocus = useCallback((place: Place) => {
    const position = geoToLocal(place.lat, place.lon, 0)
    setCameraFocusTarget({ position, distance: CAMERA_DISTANCES.place })
  }, [setCameraFocusTarget])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-white/40">
        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-orange-400 rounded-full" />
        <span className="ml-2 text-sm">Loading villages...</span>
      </div>
    )
  }

  if (filteredPlaces.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-white/40">
        No villages found
      </div>
    )
  }

  return (
    <>
      {filteredPlaces.map((place) => (
        <PlaceListItem
          key={place.id}
          place={place}
          isHovered={hoveredPlaceId === place.id}
          isSelected={selectedPlaceId === place.id}
          onHover={(id) => setHoveredEntity('place', id)}
          searchParams={getSelectSearch(place)}
          onCameraFocus={() => handleCameraFocus(place)}
        />
      ))}
    </>
  )
}

interface PlaceListItemProps {
  place: Place
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  searchParams: SearchParams
  onCameraFocus: () => void
}

function PlaceListItem({ place, isHovered, isSelected, onHover, searchParams, onCameraFocus }: PlaceListItemProps) {
  const getIcon = () => {
    switch (place.type) {
      case 'town': return '🏘️'
      case 'village': return '🏠'
      case 'hamlet': return '🏡'
    }
  }

  const getTypeLabel = () => {
    switch (place.type) {
      case 'town': return 'Town'
      case 'village': return 'Village'
      case 'hamlet': return 'Hamlet'
    }
  }

  return (
    <Link
      to="/"
      search={searchParams}
      onClick={onCameraFocus}
      onMouseEnter={() => onHover(place.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
        isSelected
          ? 'bg-white/20'
          : isHovered
          ? 'bg-white/10'
          : 'hover:bg-white/10'
      }`}
    >
      {/* Place icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-orange-500/20">
        <span className="text-sm">{getIcon()}</span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {place.name}
        </div>
        <div className="text-xs text-white/40">
          {getTypeLabel()}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
      )}
    </Link>
  )
}
