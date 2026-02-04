/**
 * PisteListPanel - Sidebar panel for browsing and selecting pistes/lifts
 * 
 * Features:
 * - Tabs to switch between Pistes and Lifts
 * - Difficulty filter chips (for pistes)
 * - Search input for filtering by name
 * - Grouping by ski area with collapsible sections
 * - Scrollable list with hover → highlight in 3D view
 * - Click → select and show info panel
 */

import { useState, useMemo } from 'react'
import { usePistes, groupPistesBySkiArea } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { type Difficulty } from '@/stores/useNavigationStore'
import { LIFT_TYPE_CONFIG } from '@/components/map/Lifts'
import type { Piste, Lift } from '@/lib/api/overpass'

type Tab = 'pistes' | 'lifts'

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

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

export function PisteListPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('pistes')
  const [searchQuery, setSearchQuery] = useState('')
  const [enabledDifficulties, setEnabledDifficulties] = useState<Set<Difficulty>>(
    new Set(['blue', 'red', 'black'])
  )

  return (
    <div className="flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('pistes')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'pistes'
              ? 'border-b-2 border-blue-400 text-blue-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Pistes
        </button>
        <button
          onClick={() => setActiveTab('lifts')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'lifts'
              ? 'border-b-2 border-amber-400 text-amber-400'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Lifts
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-white/10">
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
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
                onClick={() => {
                  setEnabledDifficulties((prev) => {
                    const next = new Set(prev)
                    if (next.has(difficulty)) {
                      next.delete(difficulty)
                    } else {
                      next.add(difficulty)
                    }
                    return next
                  })
                }}
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

      {/* List Content */}
      {activeTab === 'pistes' ? (
        <PisteList
          searchQuery={searchQuery}
          enabledDifficulties={enabledDifficulties}
        />
      ) : (
        <LiftList searchQuery={searchQuery} />
      )}
    </div>
  )
}

interface PisteListProps {
  searchQuery: string
  enabledDifficulties: Set<Difficulty>
}

function PisteList({ searchQuery, enabledDifficulties }: PisteListProps) {
  const { data: pistes, isLoading } = usePistes()
  const hoveredPisteId = useMapStore((s) => s.hoveredPisteId)
  const selectedPisteId = useMapStore((s) => s.selectedPisteId)
  const setHoveredPiste = useMapStore((s) => s.setHoveredPiste)
  const setSelectedPiste = useMapStore((s) => s.setSelectedPiste)
  
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
    <div className="overflow-y-auto flex-1">
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
                onHover={setHoveredPiste}
                onSelect={setSelectedPiste}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

interface PisteListItemProps {
  piste: Piste
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

function PisteListItem({ piste, isHovered, isSelected, onHover, onSelect }: PisteListItemProps) {
  // Use pre-calculated length if available, otherwise calculate
  const length = piste.length ?? calculateLength(piste.coordinates)

  return (
    <div
      onMouseEnter={() => onHover(piste.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(piste.id)}
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
    </div>
  )
}

interface LiftListProps {
  searchQuery: string
}

function LiftList({ searchQuery }: LiftListProps) {
  const { data: lifts, isLoading } = useLifts()
  const hoveredLiftId = useMapStore((s) => s.hoveredLiftId)
  const selectedLiftId = useMapStore((s) => s.selectedLiftId)
  const setHoveredLift = useMapStore((s) => s.setHoveredLift)
  const setSelectedLift = useMapStore((s) => s.setSelectedLift)

  const filteredLifts = useMemo(() => {
    if (!lifts) return []
    
    return lifts
      .filter((lift) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return lift.name.toLowerCase().includes(query)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [lifts, searchQuery])

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
    <div className="overflow-y-auto flex-1">
      {filteredLifts.map((lift) => (
        <LiftListItem
          key={lift.id}
          lift={lift}
          isHovered={hoveredLiftId === lift.id}
          isSelected={selectedLiftId === lift.id}
          onHover={setHoveredLift}
          onSelect={setSelectedLift}
        />
      ))}
    </div>
  )
}

interface LiftListItemProps {
  lift: Lift
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

function LiftListItem({ lift, isHovered, isSelected, onHover, onSelect }: LiftListItemProps) {
  const length = useMemo(() => calculateLength(lift.coordinates), [lift.coordinates])
  const config = LIFT_TYPE_CONFIG[lift.type as keyof typeof LIFT_TYPE_CONFIG] ?? LIFT_TYPE_CONFIG['Lift']

  return (
    <div
      onMouseEnter={() => onHover(lift.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(lift.id)}
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
    </div>
  )
}
