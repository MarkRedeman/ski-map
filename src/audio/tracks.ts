/**
 * Track definitions for ride playback audio
 * 
 * Each category has one or more tracks that can be played during
 * the corresponding segment type. Tracks are royalty-free.
 */

import type { Track, TrackCategory } from './types'

/**
 * All available tracks organized by category
 * 
 * Tracks are stored in /public/audio/ and served from root /audio/
 */
export const TRACKS: Track[] = [
  // Blue slopes - chill, relaxed electronic
  {
    id: 'skiing-blue-1',
    category: 'skiing-blue',
    url: '/audio/skiing-blue.mp3',
    name: 'Chill Slopes',
    loop: true,
  },
  
  // Red slopes - upbeat, energetic
  {
    id: 'skiing-red-1',
    category: 'skiing-red',
    url: '/audio/skiing-red.mp3',
    name: 'Powder Rush',
    loop: true,
  },
  
  // Black slopes - intense, driving
  {
    id: 'skiing-black-1',
    category: 'skiing-black',
    url: '/audio/skiing-black.mp3',
    name: 'Adrenaline Peak',
    loop: true,
  },
  
  // Lift rides - ambient, scenic
  {
    id: 'lift-1',
    category: 'lift',
    url: '/audio/lift.mp3',
    name: 'Scenic Ascent',
    loop: true,
  },
  
  // Idle/waiting - very calm, nature sounds
  {
    id: 'idle-1',
    category: 'idle',
    url: '/audio/idle.mp3',
    name: 'Mountain Breeze',
    loop: true,
  },
]

/**
 * Get tracks by category
 */
export function getTracksForCategory(category: TrackCategory): Track[] {
  return TRACKS.filter(t => t.category === category)
}

/**
 * Get a single track for a category (first available)
 * In the future, this could randomly select or rotate tracks
 */
export function getTrackForCategory(category: TrackCategory): Track | null {
  const tracks = getTracksForCategory(category)
  return tracks[0] ?? null
}

/**
 * Get a track by ID
 */
export function getTrackById(id: string): Track | null {
  return TRACKS.find(t => t.id === id) ?? null
}

/**
 * Preload URLs for all tracks (for audio manager initialization)
 */
export function getAllTrackUrls(): string[] {
  return TRACKS.map(t => t.url)
}
