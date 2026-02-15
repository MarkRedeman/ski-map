/**
 * Sidebar - Collapsible navigation sidebar
 *
 * Contains:
 * - Brand row (logo + settings toggle + offline indicator)
 * - Location tracking controls
 * - My Rides section
 * - Browse Slopes & Lifts
 * - Collapsible Settings section
 *
 * Slides in/out from the left. State managed by useUIStore.
 */

import { useRef, useState, useCallback } from 'react';
import { Plus, Mountain, Settings, ChevronDown } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { LocationButton } from '@/components/sidebar/LocationButton';
import { PisteListPanel } from '@/components/sidebar/PisteListPanel';
import { RideListPanel } from '@/components/sidebar/rides/RideListPanel';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { SettingsContent } from '@/components/layout/SettingsPanel';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        {/* Brand row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-amber-500" />
            <span className="text-base font-bold text-amber-500">Sölden Navigator</span>
          </Link>
          <OfflineIndicator />
        </div>

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

        {/* Settings section — collapsible */}
        <section className="border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center justify-between bg-black/30 px-4 py-2 text-left transition-colors hover:bg-black/40"
          >
            <div className="flex items-center gap-1.5">
              <Settings
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  settingsOpen ? 'text-amber-400' : 'text-white/50'
                )}
              />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Settings
              </h2>
            </div>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-white/40 transition-transform duration-200',
                settingsOpen && 'rotate-180'
              )}
            />
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out',
              settingsOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <SettingsContent />
          </div>
        </section>
      </div>
    </aside>
  );
}
