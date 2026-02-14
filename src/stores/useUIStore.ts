/**
 * UI Store - Manages UI state for panels and sidebar
 * 
 * Persists state to localStorage so preferences survive page refresh.
 * Defaults to collapsed sidebar on mobile devices.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  
  // Map Controls panel (bottom-left) - layers, filters, quality
  controlsExpanded: boolean
  toggleControls: () => void
  setControlsExpanded: (expanded: boolean) => void
}

/**
 * Detect if we're on a mobile device (width < 768px)
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar - default closed on mobile, open on desktop
      sidebarOpen: !isMobileDevice(),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      // Controls - default collapsed on mobile
      controlsExpanded: !isMobileDevice(),
      toggleControls: () => set((state) => ({ controlsExpanded: !state.controlsExpanded })),
      setControlsExpanded: (expanded) => set({ controlsExpanded: expanded }),
    }),
    {
      name: 'solden-ui-state',
      // Only persist the open/expanded states, not the functions
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        controlsExpanded: state.controlsExpanded,
      }),
    }
  )
)
