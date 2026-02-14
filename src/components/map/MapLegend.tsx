/**
 * MapLegend component - Collapsible filter panel for pistes and lifts
 * 
 * Displays all lift types and piste difficulties with their colors and icons.
 * Clicking on an item toggles its visibility on the map.
 * 
 * On mobile, collapses to a small "Filters" button.
 */

import { ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useMapStore, ALL_LIFT_TYPES, type LiftType } from '@/stores/useMapStore'
import { ALL_DIFFICULTIES, type Difficulty } from '@/lib/api/overpass'
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter'
import { useUIStore } from '@/stores/useUIStore'
import { LIFT_TYPE_CONFIG } from './Lifts'
import { PISTE_DIFFICULTY_CONFIG } from './Pistes'

export function MapLegend() {
  const legendExpanded = useUIStore((s) => s.legendExpanded)
  const toggleLegend = useUIStore((s) => s.toggleLegend)

  // Count active filters for collapsed state indicator
  const { enabledDifficulties } = useDifficultyFilter()
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const activeFilters = enabledDifficulties.size + visibleLiftTypes.size
  const totalFilters = ALL_DIFFICULTIES.length + ALL_LIFT_TYPES.length - 1 // -1 for 'Lift' type we hide

  if (!legendExpanded) {
    // Collapsed state - show compact button
    return (
      <button
        onClick={toggleLegend}
        className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-2 backdrop-blur-md transition-all hover:bg-black/90"
        title="Expand filter panel"
      >
        <SlidersHorizontal className="h-4 w-4 text-white" />
        <span className="text-xs font-medium text-white">Filters</span>
        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
          {activeFilters}/{totalFilters}
        </span>
        <ChevronUp className="h-3 w-3 text-white/60" />
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-3 rounded-lg bg-black/80 p-3 backdrop-blur-md">
      {/* Header with collapse button */}
      <button
        onClick={toggleLegend}
        className="flex items-center justify-between gap-2 text-white/60 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-xs font-semibold">Filters</span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </button>
      
      <div className="h-px bg-white/20" />
      <PisteLegend />
      <div className="h-px bg-white/20" />
      <LiftLegend />
    </div>
  )
}

/**
 * Piste difficulty filter section
 */
function PisteLegend() {
  const { enabledDifficulties, toggleDifficulty, setDifficulties } = useDifficultyFilter()
  
  const allVisible = enabledDifficulties.size === ALL_DIFFICULTIES.length
  const noneVisible = enabledDifficulties.size === 0
  
  return (
    <div className="flex flex-col gap-2">
      {/* Header with show all / hide all */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-white">Pistes</span>
        <div className="flex gap-1">
          <button
            onClick={() => setDifficulties([...ALL_DIFFICULTIES])}
            disabled={allVisible}
            className={`
              rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
              ${allVisible
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
            `}
          >
            All
          </button>
          <button
            onClick={() => setDifficulties([])}
            disabled={noneVisible}
            className={`
              rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
              ${noneVisible
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
            `}
          >
            None
          </button>
        </div>
      </div>
      
      {/* Difficulty toggles - single row */}
      <div className="flex gap-1">
        {ALL_DIFFICULTIES.map((difficulty) => (
          <DifficultyToggle
            key={difficulty}
            difficulty={difficulty}
            isVisible={enabledDifficulties.has(difficulty)}
            onToggle={() => toggleDifficulty(difficulty)}
          />
        ))}
      </div>
    </div>
  )
}

interface DifficultyToggleProps {
  difficulty: Difficulty
  isVisible: boolean
  onToggle: () => void
}

function DifficultyToggle({ difficulty, isVisible, onToggle }: DifficultyToggleProps) {
  const config = PISTE_DIFFICULTY_CONFIG[difficulty]
  
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-1 rounded px-2 py-1 transition-all
        ${isVisible
          ? 'bg-white/20 text-white'
          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }
      `}
      title={`${isVisible ? 'Hide' : 'Show'} ${config.label} pistes`}
    >
      {/* Color indicator */}
      <div
        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${!isVisible && 'opacity-40'}`}
        style={{ backgroundColor: config.color }}
      />
      
      {/* Label - capitalize first letter */}
      <span className={`text-[11px] font-medium capitalize ${!isVisible && 'opacity-40'}`}>
        {difficulty}
      </span>
    </button>
  )
}

/**
 * Lift type filter section
 */
function LiftLegend() {
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const toggleLiftType = useMapStore((s) => s.toggleLiftType)
  const setAllLiftTypesVisible = useMapStore((s) => s.setAllLiftTypesVisible)
  
  const allVisible = visibleLiftTypes.size === ALL_LIFT_TYPES.length
  const noneVisible = visibleLiftTypes.size === 0
  
  return (
    <div className="flex flex-col gap-2">
      {/* Header with show all / hide all */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-white">Lifts</span>
        <div className="flex gap-1">
          <button
            onClick={() => setAllLiftTypesVisible(true)}
            disabled={allVisible}
            className={`
              rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
              ${allVisible
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
            `}
          >
            All
          </button>
          <button
            onClick={() => setAllLiftTypesVisible(false)}
            disabled={noneVisible}
            className={`
              rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
              ${noneVisible
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
            `}
          >
            None
          </button>
        </div>
      </div>
      
      {/* Lift type toggles */}
      <div className="grid grid-cols-2 gap-1">
        {ALL_LIFT_TYPES.filter(type => type !== 'Lift').map((liftType) => (
          <LiftTypeToggle
            key={liftType}
            liftType={liftType}
            isVisible={visibleLiftTypes.has(liftType)}
            onToggle={() => toggleLiftType(liftType)}
          />
        ))}
      </div>
    </div>
  )
}

interface LiftTypeToggleProps {
  liftType: LiftType
  isVisible: boolean
  onToggle: () => void
}

function LiftTypeToggle({ liftType, isVisible, onToggle }: LiftTypeToggleProps) {
  const config = LIFT_TYPE_CONFIG[liftType]
  
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-1.5 rounded px-2 py-1 text-left transition-all
        ${isVisible
          ? 'bg-white/20 text-white'
          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
        }
      `}
      title={`${isVisible ? 'Hide' : 'Show'} ${liftType}`}
    >
      {/* Color indicator */}
      <div
        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${!isVisible && 'opacity-40'}`}
        style={{ backgroundColor: config.color }}
      />
      
      {/* Icon */}
      <span className={`text-sm ${!isVisible && 'opacity-40'}`}>{config.icon}</span>
      
      {/* Label */}
      <span className={`text-[11px] font-medium whitespace-nowrap ${!isVisible && 'opacity-40'}`}>
        {liftType}
      </span>
    </button>
  )
}
