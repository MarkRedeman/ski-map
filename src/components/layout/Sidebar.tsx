import { LocationButton } from '@/components/navigation/LocationButton'
import { PisteListPanel } from '@/components/navigation/PisteListPanel'

export function Sidebar() {
  return (
    <aside className="w-80 flex-shrink-0 flex flex-col bg-black/80 backdrop-blur-md">
      <div className="p-4 flex-shrink-0">
        {/* My Location */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            My Location
          </h2>
          <LocationButton />
        </section>
      </div>

      {/* Piste/Lift Browser - takes remaining height */}
      <section className="border-t border-white/10 flex-1 flex flex-col min-h-0">
        <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50 bg-white/5 flex-shrink-0">
          Browse Slopes & Lifts
        </h2>
        <div className="flex-1 overflow-y-auto">
          <PisteListPanel />
        </div>
      </section>
    </aside>
  )
}
