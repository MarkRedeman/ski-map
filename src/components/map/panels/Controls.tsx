/**
 * MapControls component - Unified control panel for the 3D map
 *
 * Collapsible panel positioned at the bottom-left of the map.
 *
 * Sections (top to bottom when expanded):
 *   1. Piste Filters — Difficulty toggles with All/None
 *   2. Lift Filters — Lift type toggles with All/None
 *   3. Quality — Resolution selector (1x–16x) with loading spinner
 *   4. Labels — Toggle visibility of peak/place labels (eye icon)
 *
 * On mobile, collapses to a compact button showing active filter count
 * and current resolution.
 */

import { Navigation, ChevronUp, ChevronDown, Settings2, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore, type ResolutionLevel } from '@/stores/useSettingsStore';
import { useMapStore, ALL_LIFT_TYPES, type LiftType } from '@/stores/useMapStore';
import { useGeolocationStore } from '@/stores/useGeolocationStore';
import { useUIStore } from '@/stores/useUIStore';
import { ALL_DIFFICULTIES, type Difficulty } from '@/lib/api/overpass';
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter';
import { geoToLocal } from '@/lib/geo/coordinates';
import { cn } from '@/lib/utils';
import { LIFT_TYPE_CONFIG } from '../Lifts';
import { PISTE_DIFFICULTY_CONFIG } from '../Pistes';
import { Panel, PANEL_CLASSES } from './Panel';

const RESOLUTION_LEVELS: ResolutionLevel[] = ['1x', '2x', '4x', '8x', '16x'];

export function MapControls() {
  const controlsExpanded = useUIStore((s) => s.controlsExpanded);
  const toggleControls = useUIStore((s) => s.toggleControls);

  // Labels visibility
  const showLabels = useMapStore((s) => s.showLabels);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  // Resolution
  const resolution = useSettingsStore((s) => s.resolution);
  const setResolution = useSettingsStore((s) => s.setResolution);
  const isLoading = useMapStore((s) => s.isLoadingTerrain);

  // Locate me
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);
  const userLocation = useGeolocationStore((s) => s.userLocation);
  const isTrackingLocation = useGeolocationStore((s) => s.isTrackingLocation);

  // Filter counts for collapsed state
  const { enabledDifficulties } = useDifficultyFilter();
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const activeFilters = enabledDifficulties.size + visibleLiftTypes.size;
  const totalFilters = ALL_DIFFICULTIES.length + ALL_LIFT_TYPES.length - 1; // -1 for generic 'Lift' type we hide

  const handleLocateMe = () => {
    if (!userLocation) return;
    const [lat, lon, elevation] = userLocation;
    const [x, y, z] = geoToLocal(lat, lon, elevation);
    setCameraFocusTarget({ position: [x, y, z], distance: 150 });
  };

  // --- Collapsed state ---
  if (!controlsExpanded) {
    return (
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        {/* Locate me button - always visible when tracking (even collapsed) */}
        {isTrackingLocation && userLocation && (
          <button
            onClick={handleLocateMe}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            title="Center map on my location"
          >
            <Navigation className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={toggleControls}
          className={cn(PANEL_CLASSES, 'flex items-center gap-2 px-3 py-2 transition-all')}
          title="Expand controls"
        >
          <Settings2 className="h-4 w-4 text-white" />
          <span className="text-xs font-medium text-white">Controls</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            {activeFilters}/{totalFilters}
          </span>
          <span className="text-xs font-medium text-white">{resolution}</span>
          {isLoading && <LoadingSpinner size="small" />}
          <ChevronUp className="h-3 w-3 text-white/60" />
        </button>
      </div>
    );
  }

  // --- Expanded state ---
  return (
    <Panel className="absolute bottom-4 left-4 flex flex-col gap-3 p-3">
      {/* Header with collapse button */}
      <button
        onClick={toggleControls}
        className="flex items-center justify-between gap-2 text-white/60 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs font-semibold">Controls</span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Locate me button */}
      {isTrackingLocation && userLocation && (
        <>
          <div className="h-px bg-white/20" />
          <button
            onClick={handleLocateMe}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors bg-amber-500 text-white hover:bg-amber-600"
            title="Center map on my location"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Find Me</span>
          </button>
        </>
      )}

      {/* --- Piste Filters section --- */}
      <div className="h-px bg-white/20" />
      <PisteFilters />

      {/* --- Lift Filters section --- */}
      <div className="h-px bg-white/20" />
      <LiftFilters />

      {/* --- Quality section --- */}
      <div className="h-px bg-white/20" />
      <QualitySelector
        resolution={resolution}
        setResolution={setResolution}
        isLoading={isLoading}
      />

      {/* --- Labels toggle --- */}
      <div className="h-px bg-white/20" />
      <button
        onClick={() => toggleLayer('labels')}
        className="flex items-center justify-between gap-3 transition-colors hover:text-white/80"
        title={showLabels ? 'Hide labels' : 'Show labels'}
      >
        <span className="text-xs font-semibold text-white">Labels</span>
        {showLabels ? (
          <Eye className="h-4 w-4 text-amber-400" />
        ) : (
          <EyeOff className="h-4 w-4 text-white/30" />
        )}
      </button>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (all in this file to avoid unnecessary small files)
// ---------------------------------------------------------------------------

/**
 * Loading spinner - reused in collapsed and expanded states
 */
function LoadingSpinner({ size = 'normal' }: { size?: 'small' | 'normal' }) {
  const cls = size === 'small' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <svg
      className={`${cls} animate-spin text-amber-400`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Resolution quality selector row
 */
function QualitySelector({
  resolution,
  setResolution,
  isLoading,
}: {
  resolution: ResolutionLevel;
  setResolution: (level: ResolutionLevel) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-white">Quality</span>
      <div className="flex gap-1">
        {RESOLUTION_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setResolution(level)}
            disabled={isLoading}
            className={`
              rounded px-2 py-1 text-xs font-medium transition-colors
              ${
                resolution === level
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }
              ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
            title={`Set terrain resolution to ${level}`}
          >
            {level}
          </button>
        ))}
      </div>
      {isLoading && (
        <div className="ml-1">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}

/**
 * Piste difficulty filter section
 */
function PisteFilters() {
  const { enabledDifficulties, toggleDifficulty, setDifficulties } = useDifficultyFilter();

  const allVisible = enabledDifficulties.size === ALL_DIFFICULTIES.length;
  const noneVisible = enabledDifficulties.size === 0;

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
              ${
                allVisible
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
              ${
                noneVisible
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
  );
}

function DifficultyToggle({
  difficulty,
  isVisible,
  onToggle,
}: {
  difficulty: Difficulty;
  isVisible: boolean;
  onToggle: () => void;
}) {
  const config = PISTE_DIFFICULTY_CONFIG[difficulty];

  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-1 rounded px-2 py-1 transition-all
        ${
          isVisible
            ? 'bg-white/10 text-white/70'
            : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
        }
      `}
      title={`${isVisible ? 'Hide' : 'Show'} ${config.label} pistes`}
    >
      <div
        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color, opacity: isVisible ? 0.8 : 0.3 }}
      />
      <span className={`text-[11px] font-medium capitalize ${!isVisible && 'opacity-40'}`}>
        {difficulty}
      </span>
    </button>
  );
}

/**
 * Lift type filter section
 */
function LiftFilters() {
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const toggleLiftType = useMapStore((s) => s.toggleLiftType);
  const setAllLiftTypesVisible = useMapStore((s) => s.setAllLiftTypesVisible);

  const allVisible = visibleLiftTypes.size === ALL_LIFT_TYPES.length;
  const noneVisible = visibleLiftTypes.size === 0;

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
              ${
                allVisible
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
              ${
                noneVisible
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
        {ALL_LIFT_TYPES.filter((type) => type !== 'Lift').map((liftType) => (
          <LiftTypeToggle
            key={liftType}
            liftType={liftType}
            isVisible={visibleLiftTypes.has(liftType)}
            onToggle={() => toggleLiftType(liftType)}
          />
        ))}
      </div>
    </div>
  );
}

function LiftTypeToggle({
  liftType,
  isVisible,
  onToggle,
}: {
  liftType: LiftType;
  isVisible: boolean;
  onToggle: () => void;
}) {
  const config = LIFT_TYPE_CONFIG[liftType];

  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-1.5 rounded px-2 py-1 text-left transition-all
        ${
          isVisible
            ? 'bg-white/10 text-white/70'
            : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
        }
      `}
      title={`${isVisible ? 'Hide' : 'Show'} ${liftType}`}
    >
      <div
        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color, opacity: isVisible ? 0.8 : 0.3 }}
      />
      <span className={`text-sm ${isVisible ? 'opacity-80' : 'opacity-40'}`}>{config.icon}</span>
      <span className={`text-[11px] font-medium whitespace-nowrap ${!isVisible && 'opacity-40'}`}>
        {liftType}
      </span>
    </button>
  );
}
