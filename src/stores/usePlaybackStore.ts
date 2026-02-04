import { create } from 'zustand'

/** Available playback speeds */
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8, 16, 32, 64] as const

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

interface PlaybackState {
  // Current playback state
  isPlaying: boolean
  currentTime: number         // seconds from ride start
  playbackSpeed: number       // 0.5, 1, 2, 4, 8, 16, 32, 64
  
  // Camera follow
  cameraFollowEnabled: boolean
  
  // Skip idle
  skipIdleEnabled: boolean
  
  // Actions
  play: () => void
  pause: () => void
  toggle: () => void          // toggle play/pause
  seek: (time: number) => void
  setPlaybackSpeed: (speed: number) => void
  toggleCameraFollow: () => void
  setCameraFollow: (enabled: boolean) => void
  toggleSkipIdle: () => void
  setSkipIdle: (enabled: boolean) => void
  tick: (deltaSeconds: number) => number  // advance time by delta * speed, returns new time
  reset: () => void           // reset to initial state
}

const initialState = {
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1,
  cameraFollowEnabled: true,
  skipIdleEnabled: false,
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  // Initial state
  ...initialState,
  
  // Actions
  play: () => set({ isPlaying: true }),
  
  pause: () => set({ isPlaying: false }),
  
  toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  seek: (time: number) => set({ currentTime: Math.max(0, time) }),
  
  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
  
  toggleCameraFollow: () => set((state) => ({ cameraFollowEnabled: !state.cameraFollowEnabled })),
  
  setCameraFollow: (enabled: boolean) => set({ cameraFollowEnabled: enabled }),
  
  toggleSkipIdle: () => set((state) => ({ skipIdleEnabled: !state.skipIdleEnabled })),
  
  setSkipIdle: (enabled: boolean) => set({ skipIdleEnabled: enabled }),
  
  tick: (deltaSeconds: number) => {
    const state = get()
    
    // Only advance time if playing
    if (!state.isPlaying) {
      return state.currentTime
    }
    
    const newTime = state.currentTime + deltaSeconds * state.playbackSpeed
    set({ currentTime: newTime })
    return newTime
  },
  
  reset: () => set(initialState),
}))
