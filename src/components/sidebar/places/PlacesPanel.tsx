/**
 * PlacesPanel - Main sidebar panel for browsing pistes, lifts, peaks, villages, and restaurants
 *
 * Owns tab state, search query, and filter state.
 * Delegates tab/search/filter UI to PlacesTabs, and list rendering to per-tab list components.
 */

import { useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter';
import { PlacesTabs, type Tab } from './PlacesTabs';
import { PisteList } from './PisteList';
import { LiftList } from './LiftList';
import { PeakList } from './PeakList';
import { VillageList } from './VillageList';
import { RestaurantList } from './DiningList';

export function PlacesPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('pistes');
  const [searchQuery, setSearchQuery] = useState('');

  // URL-native difficulty filter (synced with MapControls)
  const { enabledDifficulties, toggleDifficulty } = useDifficultyFilter();
  const visibleLiftTypes = useMapStore((s) => s.visibleLiftTypes);
  const toggleLiftType = useMapStore((s) => s.toggleLiftType);

  return (
    <div className="flex flex-col h-full">
      <PlacesTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        enabledDifficulties={enabledDifficulties}
        onToggleDifficulty={toggleDifficulty}
        visibleLiftTypes={visibleLiftTypes}
        onToggleLiftType={toggleLiftType}
      />

      {/* List Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'pistes' && (
          <PisteList searchQuery={searchQuery} enabledDifficulties={enabledDifficulties} />
        )}
        {activeTab === 'lifts' && (
          <LiftList searchQuery={searchQuery} visibleLiftTypes={visibleLiftTypes} />
        )}
        {activeTab === 'peaks' && <PeakList searchQuery={searchQuery} />}
        {activeTab === 'villages' && <VillageList searchQuery={searchQuery} />}
        {activeTab === 'restaurants' && <RestaurantList searchQuery={searchQuery} />}
      </div>
    </div>
  );
}
