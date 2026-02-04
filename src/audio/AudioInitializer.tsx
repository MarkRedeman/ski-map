/**
 * AudioInitializer - Handles Web Audio API autoplay restrictions
 * 
 * Browsers require user interaction before playing audio.
 * This component listens for the first user interaction and
 * initializes the audio context.
 * 
 * Renders nothing - just handles initialization logic.
 */

import { useEffect, useRef } from 'react'
import { audioManager } from './AudioManager'
import { useAudioStore } from './useAudioStore'

export function AudioInitializer(): null {
  const audioEnabled = useAudioStore((s) => s.enabled)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const hasInitializedRef = useRef(false)
  
  useEffect(() => {
    if (!audioEnabled || hasInitializedRef.current) return
    
    const initializeAudio = async () => {
      if (hasInitializedRef.current) return
      
      await audioManager.initialize()
      audioManager.setVolume(masterVolume)
      hasInitializedRef.current = true
      
      // Remove listeners after initialization
      document.removeEventListener('click', initializeAudio)
      document.removeEventListener('touchstart', initializeAudio)
      document.removeEventListener('keydown', initializeAudio)
    }
    
    // Listen for user interaction to initialize
    document.addEventListener('click', initializeAudio, { once: true })
    document.addEventListener('touchstart', initializeAudio, { once: true })
    document.addEventListener('keydown', initializeAudio, { once: true })
    
    return () => {
      document.removeEventListener('click', initializeAudio)
      document.removeEventListener('touchstart', initializeAudio)
      document.removeEventListener('keydown', initializeAudio)
    }
  }, [audioEnabled, masterVolume])
  
  return null
}
