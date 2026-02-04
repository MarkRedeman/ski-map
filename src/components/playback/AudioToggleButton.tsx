/**
 * AudioToggleButton - Speaker icon button with volume control
 * 
 * Shows a speaker icon that toggles audio on/off.
 * Displays a volume slider popover on hover/click when enabled.
 * Shows current track info when playing.
 */

import { useState, useRef, useEffect } from 'react'
import { useAudioStore } from '@/audio/useAudioStore'
import { useCurrentTrackInfo } from '@/audio/usePlaybackAudio'

export function AudioToggleButton() {
  const enabled = useAudioStore((s) => s.enabled)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const toggleEnabled = useAudioStore((s) => s.toggleEnabled)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)
  
  const trackInfo = useCurrentTrackInfo()
  const [showPopover, setShowPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // Close popover when clicking outside
  useEffect(() => {
    if (!showPopover) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPopover])
  
  const volumePercent = Math.round(masterVolume * 100)
  
  // Speaker icon based on state
  const SpeakerIcon = () => {
    if (!enabled) {
      // Muted
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
          <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
        </svg>
      )
    }
    
    if (masterVolume === 0) {
      // Volume at 0
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    
    if (masterVolume < 0.5) {
      // Low volume
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
        </svg>
      )
    }
    
    // High volume
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" />
      </svg>
    )
  }
  
  return (
    <div className="relative">
      {/* Main toggle button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!enabled) {
            toggleEnabled()
          } else {
            setShowPopover(!showPopover)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          toggleEnabled()
        }}
        className={`
          flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors
          ${enabled
            ? 'bg-purple-500 text-white hover:bg-purple-600'
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }
        `}
        title={enabled ? 'Click to adjust volume, right-click to mute' : 'Enable sound'}
      >
        <SpeakerIcon />
        {enabled && trackInfo && (
          <span className="max-w-[80px] truncate text-[10px] opacity-90">
            {trackInfo.name}
          </span>
        )}
      </button>
      
      {/* Volume popover */}
      {showPopover && enabled && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-slate-800 p-3 shadow-xl"
          style={{ minWidth: '180px' }}
        >
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-slate-800" />
          
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white">Sound</span>
            <button
              onClick={toggleEnabled}
              className="rounded p-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
              title="Mute"
            >
              ✕
            </button>
          </div>
          
          {/* Volume slider */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/60">
              <span>Volume</span>
              <span>{volumePercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumePercent}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full 
                         [&::-webkit-slider-thumb]:bg-purple-400"
            />
          </div>
          
          {/* Now playing */}
          {trackInfo && (
            <div className="border-t border-white/10 pt-2">
              <div className="text-[10px] text-white/50">Now Playing</div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🎵</span>
                <div>
                  <div className="text-xs font-medium text-white">{trackInfo.name}</div>
                  <div className="text-[10px] text-white/60">{trackInfo.category}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
