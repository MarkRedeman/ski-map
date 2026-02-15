/**
 * Sidebar - Collapsible navigation sidebar
 *
 * Contains:
 * - Location tracking controls
 * - My Rides section
 * - Browse Slopes & Lifts
 *
 * Slides in/out from the left. State managed by useUIStore.
 */

import { useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { LocationButton } from '@/components/sidebar/LocationButton';
import { PisteListPanel } from '@/components/sidebar/PisteListPanel';
import { RideListPanel } from '@/components/rides/RideListPanel';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { parseGPXFile } = await import('@/lib/garmin/parser');
    const { useRunsStore } = await import('@/stores/useRunsStore');
    const addRun = useRunsStore.getState().addRun;

    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith('.gpx')) {
        try {
          const run = await parseGPXFile(file);
          await addRun(run);
        } catch (err) {
          console.error('Failed to parse file:', file.name, err);
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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

        {/* My Rides section */}
        <section className="border-t border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between bg-black/30 px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              My Rides
            </h2>
            <button
              onClick={handleAddClick}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
              title="Add ride (.gpx)"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </button>
          </div>
          {/* Hidden file input for add button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
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
  );
}
