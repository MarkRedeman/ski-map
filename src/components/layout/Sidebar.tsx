import { DifficultyFilter } from '@/components/navigation/DifficultyFilter'
import { SearchPanel } from '@/components/navigation/SearchPanel'
import { RouteCard } from '@/components/navigation/RouteCard'
import { LocationButton } from '@/components/navigation/LocationButton'
import { PisteListPanel } from '@/components/navigation/PisteListPanel'
import { useNavigationStore } from '@/stores/useNavigationStore'

export function Sidebar() {
  const { selectedRoute } = useNavigationStore()

  return (
    <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
      <div className="p-4 space-y-6">
        {/* My Location */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            My Location
          </h2>
          <LocationButton />
        </section>

        {/* Search / Navigation Panel */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Navigate
          </h2>
          <SearchPanel />
        </section>

        {/* Difficulty Filter */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Difficulty Filter
          </h2>
          <DifficultyFilter />
        </section>

        {/* Route Results */}
        {selectedRoute && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Route
            </h2>
            <RouteCard route={selectedRoute} />
          </section>
        )}
      </div>

      {/* Piste/Lift Browser */}
      <section className="border-t border-slate-200">
        <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 bg-slate-50">
          Browse Slopes & Lifts
        </h2>
        <PisteListPanel />
      </section>
    </aside>
  )
}
