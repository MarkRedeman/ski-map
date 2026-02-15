/**
 * SidebarToggle - Floating button to toggle sidebar visibility
 *
 * Positioned in the top-left corner of the map area.
 * When sidebar is closed: shows Mountain brand icon + hamburger menu.
 * When sidebar is open: shows X to close.
 */

import { Menu, X, Mountain } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';
import { PANEL_CLASSES } from './Panel';

export function SidebarToggle() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        PANEL_CLASSES,
        'absolute top-4 left-4 z-10 flex items-center gap-2 px-3 h-10 text-white transition-all'
      )}
      title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      {sidebarOpen ? (
        <X className="h-5 w-5" />
      ) : (
        <>
          <Mountain className="h-5 w-5 text-amber-500" />
          <Menu className="h-5 w-5" />
        </>
      )}
    </button>
  );
}
