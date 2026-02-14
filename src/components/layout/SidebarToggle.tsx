/**
 * SidebarToggle - Floating hamburger button to toggle sidebar visibility
 * 
 * Positioned in the top-left corner of the map area.
 * Shows hamburger (☰) when sidebar is closed, X when open.
 */

import { Menu, X } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'

export function SidebarToggle() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <button
      onClick={toggleSidebar}
      className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg bg-black/80 text-white shadow-lg shadow-black/30 backdrop-blur-md transition-all hover:bg-black/90"
      title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      {sidebarOpen ? (
        <X className="h-5 w-5" />
      ) : (
        <Menu className="h-5 w-5" />
      )}
    </button>
  )
}
