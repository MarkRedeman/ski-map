/**
 * Audio system types
 * 
 * This module defines all types for the ride playback audio system.
 * Music changes dynamically based on the current segment type.
 */

import type { Difficulty } from '@/stores/useNavigationStore'

/**
 * Track categories that map to ride segment types
 */
export type TrackCategory = 
  | 'skiing-blue'   // Easy slopes - chill, relaxed music
  | 'skiing-red'    // Intermediate slopes - upbeat, energetic
  | 'skiing-black'  // Expert slopes - intense, driving
  | 'lift'          // Lift rides - ambient, scenic
  | 'idle'          // Waiting/rest - very calm

/**
 * A single audio track definition
 */
export interface Track {
  /** Unique identifier */
  id: string
  /** Category this track belongs to */
  category: TrackCategory
  /** URL to the audio file (relative to public or absolute) */
  url: string
  /** Display name for UI */
  name: string
  /** Optional artist name */
  artist?: string
  /** Duration in seconds (for UI display) */
  duration?: number
  /** Whether to loop (default: true) */
  loop?: boolean
}

/**
 * Audio playback state
 */
export interface AudioState {
  /** Master enable/disable toggle */
  enabled: boolean
  /** Master volume (0-1) */
  masterVolume: number
  /** Currently playing track ID */
  currentTrackId: string | null
  /** Whether audio is actively playing */
  isPlaying: boolean
}

/**
 * Map segment type + difficulty to track category
 */
export function getTrackCategoryForSegment(
  segmentType: 'skiing' | 'lift' | 'idle',
  difficulty?: Difficulty
): TrackCategory {
  switch (segmentType) {
    case 'skiing':
      switch (difficulty) {
        case 'red':
          return 'skiing-red'
        case 'black':
          return 'skiing-black'
        case 'blue':
        default:
          return 'skiing-blue'
      }
    case 'lift':
      return 'lift'
    case 'idle':
      return 'idle'
  }
}
