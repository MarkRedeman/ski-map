/**
 * LiftLegend component - shows lift type legend with filter toggles
 * 
 * Displays all lift types with their colors and icons.
 * Clicking on a lift type toggles its visibility on the map.
 */

import { useMapStore, ALL_LIFT_TYPES, type LiftType } from '@/stores/useMapStore'
import { LIFT_TYPE_CONFIG } from './Lifts'

export function LiftLegend() {
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes)
  const toggleLiftType = useMapStore((s) => s.toggleLiftType)
  const setAllLiftTypesVisible = useMapStore((s) => s.setAllLiftTypesVisible)
  
  const allVisible = visibleLiftTypes.size === ALL_LIFT_TYPES.length
  const noneVisible = visibleLiftTypes.size === 0
  
  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-lg bg-black/60 p-3 backdrop-blur-sm">
      {/* Header with show all / hide all */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-white">Lift Types</span>
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
