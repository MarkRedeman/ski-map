/**
 * usePlaybackAudio - Hook that syncs audio with ride playback
 * 
 * This hook:
 * 1. Watches the current playback time and segment
 * 2. Maps segment type to track category
 * 3. Triggers crossfade when the category changes
 * 4. Handles play/pause sync with playback state
 */

import { useEffect, useRef, useMemo } from 'react'
import { usePlaybackStore } from '@/stores/usePlaybackStore'
import { useRideSegments } from '@/hooks/useRideSegments'
import { useAudioStore } from './useAudioStore'
import { audioManager } from './AudioManager'
import { getTrackForCategory } from './tracks'
import { getTrackCategoryForSegment, type TrackCategory } from './types'
import type { SkiRun } from '@/lib/garmin/types'

/** Crossfade duration between tracks in ms */
const CROSSFADE_DURATION_MS = 1500

/**
 * Hook that synchronizes audio playback with ride segments
 */
export function usePlaybackAudio(ride: SkiRun | null): void {
  const segments = useRideSegments(ride)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const audioEnabled = useAudioStore((s) => s.enabled)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setCurrentTrackId = useAudioStore((s) => s.setCurrentTrackId)
  
  // Track the last category to detect changes
  const lastCategoryRef = useRef<TrackCategory | null>(null)
  const isInitializedRef = useRef(false)
  
  // Find current segment based on playback time
  const currentSegment = useMemo(() => {
    if (segments.length === 0) return null
    
    return segments.find(s => 
      currentTime >= s.startTime && currentTime < s.endTime
    ) ?? null
  }, [segments, currentTime])
  
  // Map segment to track category
  const targetCategory = useMemo((): TrackCategory | null => {
    if (!currentSegment) return null
    
    return getTrackCategoryForSegment(
      currentSegment.type,
      currentSegment.difficulty
    )
  }, [currentSegment])
  
  // Initialize audio manager when enabled
  useEffect(() => {
    if (audioEnabled && !isInitializedRef.current) {
      audioManager.initialize().then(() => {
        audioManager.setVolume(masterVolume)
        isInitializedRef.current = true
      })
    }
  }, [audioEnabled, masterVolume])
  
  // Sync volume changes
  useEffect(() => {
    if (isInitializedRef.current) {
      audioManager.setVolume(masterVolume)
    }
  }, [masterVolume])
  
  // Handle playback state changes and category changes
  useEffect(() => {
    // Audio disabled - stop everything
    if (!audioEnabled) {
      audioManager.stop({ fadeOutMs: 300 })
      setCurrentTrackId(null)
      lastCategoryRef.current = null
      return
    }
    
    // Not playing - stop audio
    if (!isPlaying) {
      audioManager.stop({ fadeOutMs: 500 })
      setCurrentTrackId(null)
      lastCategoryRef.current = null
      return
    }
    
    // No target category - stop audio
    if (!targetCategory) {
      audioManager.stop({ fadeOutMs: 500 })
      setCurrentTrackId(null)
      lastCategoryRef.current = null
      return
    }
    
    // Category hasn't changed - do nothing
    if (targetCategory === lastCategoryRef.current) {
      return
    }
    
    // Category changed - crossfade to new track
    const track = getTrackForCategory(targetCategory)
    if (track) {
      audioManager.crossfadeTo(track.id, CROSSFADE_DURATION_MS)
      setCurrentTrackId(track.id)
    }
    
    lastCategoryRef.current = targetCategory
  }, [audioEnabled, isPlaying, targetCategory, setCurrentTrackId])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioManager.stop({ fadeOutMs: 300 })
      setCurrentTrackId(null)
    }
  }, [setCurrentTrackId])
}

/**
 * Get display info for the currently playing track
 */
export function useCurrentTrackInfo(): { name: string; category: string } | null {
  const currentTrackId = useAudioStore((s) => s.currentTrackId)
  
  return useMemo(() => {
    if (!currentTrackId) return null
    
    // Parse track ID to get info
    // Format: "{category}-{number}" e.g., "skiing-blue-1"
    const categoryMap: Record<string, string> = {
      'skiing-blue': 'Blue Slope',
      'skiing-red': 'Red Slope', 
      'skiing-black': 'Black Slope',
      'lift': 'Lift Ride',
      'idle': 'Rest',
    }
    
    // Extract category from track ID
    const categoryMatch = currentTrackId.match(/^(skiing-blue|skiing-red|skiing-black|lift|idle)/)
    const category = categoryMatch?.[1] ?? 'Unknown'
    
    const trackNameMap: Record<string, string> = {
      'skiing-blue-1': 'Chill Slopes',
      'skiing-red-1': 'Powder Rush',
      'skiing-black-1': 'Adrenaline Peak',
      'lift-1': 'Scenic Ascent',
      'idle-1': 'Mountain Breeze',
    }
    
    return {
      name: trackNameMap[currentTrackId] ?? 'Unknown Track',
      category: categoryMap[category] ?? category,
    }
  }, [currentTrackId])
}
