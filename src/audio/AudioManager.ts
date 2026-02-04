/**
 * AudioManager - Singleton class for Web Audio API playback
 * 
 * Handles audio loading, caching, playback, and crossfading between tracks.
 * Uses the Web Audio API for precise control over volume and timing.
 * 
 * Usage:
 *   await audioManager.initialize()
 *   audioManager.play('track-id')
 *   audioManager.crossfadeTo('other-track-id', 1500)
 *   audioManager.stop()
 */

import { getTrackById } from './tracks'

/** Crossfade duration in milliseconds */
const DEFAULT_CROSSFADE_MS = 1500

/** Fade out duration when stopping */
const DEFAULT_FADE_OUT_MS = 500

/** Fade in duration when starting */
const DEFAULT_FADE_IN_MS = 300

/**
 * Active audio source with its gain node for volume control
 */
interface ActiveSource {
  source: AudioBufferSourceNode
  gainNode: GainNode
  trackId: string
}

class AudioManagerClass {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private audioCache: Map<string, AudioBuffer> = new Map()
  private activeSource: ActiveSource | null = null
  private fadingOutSource: ActiveSource | null = null
  private isInitialized = false
  private masterVolume = 0.7
  
  /**
   * Initialize the audio context
   * Must be called after user interaction due to browser autoplay policies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      this.audioContext = new AudioContext()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.masterVolume
      this.masterGain.connect(this.audioContext.destination)
      this.isInitialized = true
      
      // Resume if suspended (autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    } catch (error) {
      console.error('[AudioManager] Failed to initialize:', error)
    }
  }
  
  /**
   * Resume audio context (call after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }
  }
  
  /**
   * Suspend audio context (pause all audio processing)
   */
  suspend(): void {
    this.audioContext?.suspend()
  }
  
  /**
   * Check if audio is ready to play
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running'
  }
  
  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume
    }
  }
  
  /**
   * Get current master volume
   */
  getVolume(): number {
    return this.masterVolume
  }
  
  /**
   * Preload an audio file into cache
   */
  async preload(url: string): Promise<void> {
    if (this.audioCache.has(url)) return
    if (!this.audioContext) {
      await this.initialize()
    }
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
      this.audioCache.set(url, audioBuffer)
    } catch (error) {
      console.error(`[AudioManager] Failed to preload ${url}:`, error)
    }
  }
  
  /**
   * Get or load an audio buffer
   */
  private async getBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!
    }
    
    await this.preload(url)
    return this.audioCache.get(url) ?? null
  }
  
  /**
   * Create an audio source from a buffer
   */
  private createSource(buffer: AudioBuffer, trackId: string): ActiveSource {
    const source = this.audioContext!.createBufferSource()
    source.buffer = buffer
    source.loop = true
    
    const gainNode = this.audioContext!.createGain()
    gainNode.gain.value = 0 // Start silent for fade-in
    
    source.connect(gainNode)
    gainNode.connect(this.masterGain!)
    
    return { source, gainNode, trackId }
  }
  
  /**
   * Play a track by ID with optional fade-in
   */
  async play(trackId: string, options?: { fadeInMs?: number }): Promise<void> {
    const track = getTrackById(trackId)
    if (!track) {
      console.warn(`[AudioManager] Track not found: ${trackId}`)
      return
    }
    
    if (!this.audioContext || !this.masterGain) {
      await this.initialize()
    }
    
    // Don't restart if already playing this track
    if (this.activeSource?.trackId === trackId) {
      return
    }
    
    const buffer = await this.getBuffer(track.url)
    if (!buffer) {
      console.warn(`[AudioManager] Could not load track: ${trackId}`)
      return
    }
    
    // Stop any current playback
    this.stopImmediate()
    
    // Create and start new source
    const activeSource = this.createSource(buffer, trackId)
    activeSource.source.start(0)
    
    // Fade in
    const fadeInMs = options?.fadeInMs ?? DEFAULT_FADE_IN_MS
    const now = this.audioContext!.currentTime
    activeSource.gainNode.gain.setValueAtTime(0, now)
    activeSource.gainNode.gain.linearRampToValueAtTime(1, now + fadeInMs / 1000)
    
    this.activeSource = activeSource
  }
  
  /**
   * Stop playback with optional fade-out
   */
  stop(options?: { fadeOutMs?: number }): void {
    if (!this.activeSource || !this.audioContext) return
    
    const fadeOutMs = options?.fadeOutMs ?? DEFAULT_FADE_OUT_MS
    const now = this.audioContext.currentTime
    
    const source = this.activeSource
    source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, now)
    source.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000)
    
    // Schedule stop after fade
    setTimeout(() => {
      try {
        source.source.stop()
        source.source.disconnect()
        source.gainNode.disconnect()
      } catch {
        // Already stopped
      }
    }, fadeOutMs + 50)
    
    this.activeSource = null
  }
  
  /**
   * Stop immediately without fade
   */
  private stopImmediate(): void {
    if (this.activeSource) {
      try {
        this.activeSource.source.stop()
        this.activeSource.source.disconnect()
        this.activeSource.gainNode.disconnect()
      } catch {
        // Already stopped
      }
      this.activeSource = null
    }
    
    if (this.fadingOutSource) {
      try {
        this.fadingOutSource.source.stop()
        this.fadingOutSource.source.disconnect()
        this.fadingOutSource.gainNode.disconnect()
      } catch {
        // Already stopped
      }
      this.fadingOutSource = null
    }
  }
  
  /**
   * Crossfade to a new track
   * Smoothly transitions from current track to new track
   */
  async crossfadeTo(trackId: string, durationMs?: number): Promise<void> {
    const track = getTrackById(trackId)
    if (!track) {
      console.warn(`[AudioManager] Track not found: ${trackId}`)
      return
    }
    
    // Don't crossfade to the same track
    if (this.activeSource?.trackId === trackId) {
      return
    }
    
    if (!this.audioContext || !this.masterGain) {
      await this.initialize()
    }
    
    const fadeMs = durationMs ?? DEFAULT_CROSSFADE_MS
    const now = this.audioContext!.currentTime
    
    // Load new track
    const buffer = await this.getBuffer(track.url)
    if (!buffer) {
      console.warn(`[AudioManager] Could not load track: ${trackId}`)
      return
    }
    
    // Fade out current source
    if (this.activeSource) {
      const oldSource = this.activeSource
      oldSource.gainNode.gain.setValueAtTime(oldSource.gainNode.gain.value, now)
      oldSource.gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000)
      
      // Clean up after fade
      this.fadingOutSource = oldSource
      setTimeout(() => {
        try {
          oldSource.source.stop()
          oldSource.source.disconnect()
          oldSource.gainNode.disconnect()
        } catch {
          // Already stopped
        }
        if (this.fadingOutSource === oldSource) {
          this.fadingOutSource = null
        }
      }, fadeMs + 50)
    }
    
    // Create and start new source with fade in
    const newSource = this.createSource(buffer, trackId)
    newSource.source.start(0)
    newSource.gainNode.gain.setValueAtTime(0, now)
    newSource.gainNode.gain.linearRampToValueAtTime(1, now + fadeMs / 1000)
    
    this.activeSource = newSource
  }
  
  /**
   * Get currently playing track ID
   */
  getCurrentTrackId(): string | null {
    return this.activeSource?.trackId ?? null
  }
  
  /**
   * Check if a specific track is playing
   */
  isTrackPlaying(trackId: string): boolean {
    return this.activeSource?.trackId === trackId
  }
  
  /**
   * Clean up all resources
   */
  dispose(): void {
    this.stopImmediate()
    this.audioCache.clear()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.masterGain = null
    this.isInitialized = false
  }
}

/**
 * Singleton instance
 */
export const audioManager = new AudioManagerClass()
