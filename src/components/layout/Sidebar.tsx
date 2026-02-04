import { LocationButton } from '@/components/navigation/LocationButton'
import { PisteListPanel } from '@/components/navigation/PisteListPanel'

export function Sidebar() {
  return (
    <aside className="w-80 flex-shrink-0 overflow-y-auto bg-black/80 backdrop-blur-md">
      <div className="p-4">
        {/* My Location */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            My Location
          </h2>
          <LocationButton />
        </section>
      </div>

      {/* Piste/Lift Browser */}
      <section className="border-t border-white/10">
        <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50 bg-white/5">
          Browse Slopes & Lifts
        </h2>
        <PisteListPanel />
      </section>
    </aside>
  )
}
