/**
 * PisteListPanel - Sidebar panel for browsing and selecting pistes/lifts
 * 
 * Features:
 * - Tabs to switch between Pistes and Lifts
 * - Difficulty filter chips (for pistes)
 * - Search input for filtering by name
 * - Scrollable list with hover → highlight in 3D view
 * - Click → select and show info panel
 */

import { useState, useMemo } from 'react'
import { usePistes } from '@/hooks/usePistes'
import { useLifts } from '@/hooks/useLifts'
import { useMapStore } from '@/stores/useMapStore'
import { type Difficulty } from '@/stores/useNavigationStore'
import type { Piste, Lift } from '@/lib/api/overpass'

type Tab = 'pistes' | 'lifts'

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string; border: string }> = {
  blue: { label: 'Easy', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-300' },
  red: { label: 'Medium', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300' },
  black: { label: 'Expert', color: 'text-gray-900', bg: 'bg-gray-200', border: 'border-gray-400' },
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
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('pistes')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'pistes'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Pistes
        </button>
        <button
          onClick={() => setActiveTab('lifts')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'lifts'
              ? 'border-b-2 border-amber-500 text-amber-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Lifts
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-100">
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Difficulty Filters (only for pistes) */}
      {activeTab === 'pistes' && (
        <div className="flex gap-2 p-3 border-b border-slate-100">
          {(['blue', 'red', 'black'] as Difficulty[]).map((difficulty) => {
            const config = DIFFICULTY_CONFIG[difficulty]
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
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isEnabled
                    ? `${config.bg} ${config.color} ${config.border}`
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {config.label}
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

  const filteredPistes = useMemo(() => {
    if (!pistes) return []
    
    return pistes
      .filter((piste) => enabledDifficulties.has(piste.difficulty))
      .filter((piste) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
          piste.name.toLowerCase().includes(query) ||
          piste.ref?.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [pistes, enabledDifficulties, searchQuery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-blue-500 rounded-full" />
        <span className="ml-2 text-sm">Loading pistes...</span>
      </div>
    )
  }

  if (filteredPistes.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        No pistes found
      </div>
    )
  }

  return (
    <div className="overflow-y-auto max-h-[400px]">
      {filteredPistes.map((piste) => (
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
}

interface PisteListItemProps {
  piste: Piste
  isHovered: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

function PisteListItem({ piste, isHovered, isSelected, onHover, onSelect }: PisteListItemProps) {
  const length = useMemo(() => calculateLength(piste.coordinates), [piste.coordinates])

  return (
    <div
      onMouseEnter={() => onHover(piste.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(piste.id)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-slate-50 transition-colors ${
        isSelected
          ? 'bg-blue-50'
          : isHovered
          ? 'bg-slate-50'
          : 'hover:bg-slate-50'
      }`}
    >
      {/* Difficulty indicator */}
      <div
        className={`w-3 h-3 rounded-full flex-shrink-0 ${
          piste.difficulty === 'blue'
            ? 'bg-blue-500'
            : piste.difficulty === 'red'
            ? 'bg-red-500'
            : 'bg-gray-800'
        }`}
      />

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 truncate">
            {piste.name}
          </span>
          {piste.ref && (
            <span className="text-xs text-slate-400">#{piste.ref}</span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          {(length / 1000).toFixed(1)} km
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
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
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-amber-500 rounded-full" />
        <span className="ml-2 text-sm">Loading lifts...</span>
      </div>
    )
  }

  if (filteredLifts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        No lifts found
      </div>
    )
  }

  return (
    <div className="overflow-y-auto max-h-[400px]">
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

  return (
    <div
      onMouseEnter={() => onHover(lift.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(lift.id)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-slate-50 transition-colors ${
        isSelected
          ? 'bg-amber-50'
          : isHovered
          ? 'bg-slate-50'
          : 'hover:bg-slate-50'
      }`}
    >
      {/* Lift type icon */}
      <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center flex-shrink-0">
        <span className="text-amber-600 text-xs">
          {lift.type === 'Gondola' ? '🚡' : lift.type === 'Chair Lift' ? '🪑' : '🚠'}
        </span>
      </div>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 truncate">
          {lift.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
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
        <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
      )}
    </div>
  )
}
