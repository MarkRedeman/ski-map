import { DifficultyFilter } from '@/components/navigation/DifficultyFilter'
import { SearchPanel } from '@/components/navigation/SearchPanel'
import { RouteCard } from '@/components/navigation/RouteCard'
import { useNavigationStore } from '@/stores/useNavigationStore'

export function Sidebar() {
  const { selectedRoute } = useNavigationStore()

  return (
    <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="space-y-6">
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
    </aside>
  )
}
