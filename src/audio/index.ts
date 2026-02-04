/**
 * Audio module public exports
 * 
 * This module provides a complete audio system for ride playback.
 * To remove the audio system entirely:
 * 1. Delete this folder (src/audio/)
 * 2. Delete audio files (public/audio/)
 * 3. Remove AudioToggleButton from PlaybackControls
 * 4. Remove usePlaybackAudio hook call from ride page
 */

// Core
export { audioManager } from './AudioManager'
export { useAudioStore } from './useAudioStore'

// Hooks
export { usePlaybackAudio, useCurrentTrackInfo } from './usePlaybackAudio'

// Components
export { AudioInitializer } from './AudioInitializer'

// Types
export type { Track, TrackCategory, AudioState } from './types'
export { getTrackCategoryForSegment } from './types'

// Track utilities
export { 
  TRACKS, 
  getTrackForCategory, 
  getTracksForCategory, 
  getTrackById,
  getAllTrackUrls 
} from './tracks'
