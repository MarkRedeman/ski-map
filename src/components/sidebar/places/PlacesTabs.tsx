/**
 * PlacesTabs - Tab bar, search input, and per-tab filter chips
 */

import { ALL_LIFT_TYPES, type LiftType } from '@/stores/useMapStore';
import { type Difficulty } from '@/lib/api/overpass';
import { LIFT_TYPE_CONFIG } from '@/config/theme';
import { DIFFICULTY_COLORS } from '@/config/theme';

export type Tab = 'pistes' | 'lifts' | 'peaks' | 'villages' | 'restaurants';

interface PlacesTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  enabledDifficulties: Set<Difficulty>;
  onToggleDifficulty: (difficulty: Difficulty) => void;
  visibleLiftTypes: Set<LiftType>;
  onToggleLiftType: (liftType: LiftType) => void;
}

const TABS: { id: Tab; label: string; activeColor: string }[] = [
  { id: 'pistes', label: 'Pistes', activeColor: 'border-blue-400 text-blue-400' },
  { id: 'lifts', label: 'Lifts', activeColor: 'border-amber-400 text-amber-400' },
  { id: 'peaks', label: 'Peaks', activeColor: 'border-purple-400 text-purple-400' },
  { id: 'villages', label: 'Villages', activeColor: 'border-orange-400 text-orange-400' },
  { id: 'restaurants', label: 'Dining', activeColor: 'border-emerald-400 text-emerald-400' },
];

const PLACEHOLDERS: Record<Tab, string> = {
  pistes: 'Search pistes...',
  lifts: 'Search lifts...',
  peaks: 'Search peaks...',
  villages: 'Search villages...',
  restaurants: 'Search restaurants...',
};

export function PlacesTabs({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  enabledDifficulties,
  onToggleDifficulty,
  visibleLiftTypes,
  onToggleLiftType,
}: PlacesTabsProps) {
  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? `border-b-2 ${tab.activeColor}`
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-white/10">
        <input
          type="text"
          placeholder={PLACEHOLDERS[activeTab]}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {/* Difficulty Filters (only for pistes) */}
      {activeTab === 'pistes' && (
        <div className="flex gap-1.5 p-3 border-b border-white/10">
          {(['blue', 'red', 'black'] as Difficulty[]).map((difficulty) => {
            const isEnabled = enabledDifficulties.has(difficulty);
            return (
              <button
                key={difficulty}
                onClick={() => onToggleDifficulty(difficulty)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  isEnabled
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/5 text-white/30 hover:bg-white/10'
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: DIFFICULTY_COLORS[difficulty],
                    opacity: isEnabled ? 0.8 : 0.3,
                  }}
                />
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </button>
            );
          })}
        </div>
      )}

      {/* Lift Type Filters (only for lifts) */}
      {activeTab === 'lifts' && (
        <div className="flex flex-wrap gap-1.5 p-3 border-b border-white/10">
          {ALL_LIFT_TYPES.map((liftType) => {
            const isEnabled = visibleLiftTypes.has(liftType);
            const config =
              LIFT_TYPE_CONFIG[liftType as keyof typeof LIFT_TYPE_CONFIG] ??
              LIFT_TYPE_CONFIG['Lift'];
            return (
              <button
                key={liftType}
                onClick={() => onToggleLiftType(liftType)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all ${
                  isEnabled
                    ? 'bg-white/10 text-white/70'
                    : 'bg-white/5 text-white/30 hover:bg-white/10'
                }`}
              >
                <span className={`text-xs ${isEnabled ? 'opacity-80' : 'opacity-40'}`}>
                  {config.icon}
                </span>
                <span className="hidden sm:inline">{liftType}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
