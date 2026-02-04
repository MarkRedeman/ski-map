/**
 * Audio store - Zustand store for audio state management
 * 
 * Manages audio preferences and current playback state.
 * Persists settings to localStorage.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { audioManager } from './AudioManager'

interface AudioStore {
  /** Whether audio is enabled (user preference) */
  enabled: boolean
  /** Master volume 0-1 */
  masterVolume: number
  /** Currently playing track ID (managed by audio manager) */
  currentTrackId: string | null
  
  /** Toggle audio on/off */
  toggleEnabled: () => void
  /** Set audio enabled state */
  setEnabled: (enabled: boolean) => void
  /** Set master volume */
  setMasterVolume: (volume: number) => void
  /** Update current track ID (called by playback hook) */
  setCurrentTrackId: (trackId: string | null) => void
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set, get) => ({
      // Default: audio disabled (opt-in)
      enabled: false,
      masterVolume: 0.7,
      currentTrackId: null,
      
      toggleEnabled: () => {
        const newEnabled = !get().enabled
        set({ enabled: newEnabled })
        
        // Stop audio when disabling
        if (!newEnabled) {
          audioManager.stop({ fadeOutMs: 300 })
          set({ currentTrackId: null })
        }
      },
      
      setEnabled: (enabled) => {
        set({ enabled })
        
        if (!enabled) {
          audioManager.stop({ fadeOutMs: 300 })
          set({ currentTrackId: null })
        }
      },
      
      setMasterVolume: (volume) => {
        const clampedVolume = Math.max(0, Math.min(1, volume))
        set({ masterVolume: clampedVolume })
        audioManager.setVolume(clampedVolume)
      },
      
      setCurrentTrackId: (trackId) => {
        set({ currentTrackId: trackId })
      },
    }),
    {
      name: 'solden-audio-settings',
      // Only persist user preferences, not current playback state
      partialize: (state) => ({
        enabled: state.enabled,
        masterVolume: state.masterVolume,
      }),
    }
  )
)
