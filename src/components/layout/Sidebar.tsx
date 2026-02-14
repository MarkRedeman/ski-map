/**
 * Sidebar - Collapsible navigation sidebar
 * 
 * Contains:
 * - Location tracking controls
 * - Your Rides section
 * - Browse Slopes & Lifts
 * 
 * Slides in/out from the left. State managed by useUIStore.
 */

import { LocationButton } from '@/components/sidebar/LocationButton'
import { PisteListPanel } from '@/components/sidebar/PisteListPanel'
import { RideListPanel } from '@/components/rides/RideListPanel'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/60 transition-all duration-300 ease-in-out overflow-hidden',
        sidebarOpen ? 'w-80' : 'w-0'
      )}
    >
      {/* Inner container maintains layout even when collapsed */}
      <div className="w-80 flex flex-col h-full">
        <div className="p-4 flex-shrink-0">
          {/* My Location */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              My Location
            </h2>
            <LocationButton />
          </section>
        </div>

        {/* Your Rides section */}
        <section className="border-t border-white/10 flex-shrink-0">
          <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50 bg-black/30">
            Your Rides
          </h2>
          <RideListPanel />
        </section>

        {/* Piste/Lift Browser - takes remaining height */}
        <section className="border-t border-white/10 flex-1 flex flex-col min-h-0">
          <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50 bg-black/30 flex-shrink-0">
            Browse Slopes & Lifts
          </h2>
          <div className="flex-1 overflow-y-auto">
            <PisteListPanel />
          </div>
        </section>
      </div>
    </aside>
  )
}
