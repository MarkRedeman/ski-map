/**
 * PlaybackControls - Floating video-player-style control panel for ride playback
 *
 * Displays over the 3D map when a ride is being played back.
 * Includes play/pause, timeline scrubbing with colored segments,
 * speed control, camera follow toggle, and skip idle toggle.
 */

import { Play, Pause, Camera, ChevronDown, FastForward } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePlaybackStore, PLAYBACK_SPEEDS } from '@/stores/usePlaybackStore'
import { useRideSegments } from '@/hooks/useRideSegments'
import { getSegmentColor } from '@/lib/garmin/pisteMatch'
import type { SkiRun } from '@/lib/garmin/types'
import type { RideSegment } from '@/lib/garmin/segments'

interface PlaybackControlsProps {
  ride: SkiRun
}

/**
 * Format seconds to MM:SS or HH:MM:SS string
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function PlaybackControls({ ride }: PlaybackControlsProps) {
  const {
    isPlaying,
    currentTime,
    playbackSpeed,
    cameraFollowEnabled,
    skipIdleEnabled,
    toggle,
    seek,
    setPlaybackSpeed,
    toggleCameraFollow,
    toggleSkipIdle,
  } = usePlaybackStore()

  const segments = useRideSegments(ride)
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false)
  const [hoveredSegment, setHoveredSegment] = useState<RideSegment | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSpeedDropdownOpen(false)
      }
    }

    if (speedDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [speedDropdownOpen])

  // Clamp current time to ride duration
  const clampedTime = Math.min(currentTime, ride.duration)

  // Build the gradient for the timeline background
  const timelineGradient = useMemo(() => {
    if (segments.length === 0 || ride.duration === 0) {
      return 'rgba(255,255,255,0.2)'
    }

    const stops: string[] = []
    
    for (const segment of segments) {
      const startPercent = (segment.startTime / ride.duration) * 100
      const endPercent = (segment.endTime / ride.duration) * 100
      const color = getSegmentColor(segment)
      
      // Add color stops for this segment
      stops.push(`${color} ${startPercent}%`)
      stops.push(`${color} ${endPercent}%`)
    }

    return `linear-gradient(to right, ${stops.join(', ')})`
  }, [segments, ride.duration])

  // Calculate progress overlay gradient (shows played portion)
  const progressPercent = (clampedTime / ride.duration) * 100

  // Find current segment for display
  const currentSegment = useMemo(() => {
    return segments.find(s => clampedTime >= s.startTime && clampedTime < s.endTime)
  }, [segments, clampedTime])

  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seek(percent * ride.duration)
  }

  return (
    <div className="absolute bottom-5 left-1/2 z-10 w-full max-w-[700px] -translate-x-1/2 px-4 md:px-0">
      <div className="rounded-2xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-md">
        {/* Segment markers row */}
        {segments.length > 0 && (
          <div className="relative mb-2 h-6">
            {segments.map((segment, i) => {
              const startPercent = (segment.startTime / ride.duration) * 100
              const width = ((segment.endTime - segment.startTime) / ride.duration) * 100
              
              // Only show markers for idle segments or segment transitions
              if (segment.type !== 'idle' && width < 5) return null
              
              return (
                <div
                  key={i}
                  className="absolute top-0 flex items-center justify-center"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(width, 2)}%`,
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  {segment.type === 'idle' && (
                    <div className="flex h-5 items-center justify-center rounded bg-slate-700/80 px-1.5 text-xs text-slate-300">
                      ⏸ {formatTime(segment.endTime - segment.startTime)}
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* Hovered segment tooltip */}
            {hoveredSegment && (
              <div 
                className="absolute -top-8 z-20 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg"
                style={{
                  left: `${(hoveredSegment.startTime / ride.duration) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {hoveredSegment.type === 'skiing' && (hoveredSegment.pisteName || 'Piste')}
                {hoveredSegment.type === 'lift' && 'Lift'}
                {hoveredSegment.type === 'idle' && `Paused ${formatTime(hoveredSegment.endTime - hoveredSegment.startTime)}`}
              </div>
            )}
          </div>
        )}

        {/* Top row: Play button, Timeline, Time display */}
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={toggle}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5" />
            )}
          </button>

          {/* Timeline with colored segments */}
          <div 
            ref={timelineRef}
            className="relative flex-1 h-3 rounded-full cursor-pointer overflow-hidden"
            onClick={handleTimelineClick}
            style={{ background: timelineGradient }}
          >
            {/* Darkened overlay for unplayed portion */}
            <div 
              className="absolute inset-0 bg-black/40"
              style={{ 
                left: `${progressPercent}%`,
                width: `${100 - progressPercent}%`,
              }}
            />
            
            {/* Playhead indicator */}
            <div 
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg transition-shadow hover:shadow-xl"
              style={{ left: `${progressPercent}%` }}
            />
            
            {/* Idle segment skip indicators */}
            {segments.filter(s => s.type === 'idle').map((segment, i) => {
              const startPercent = (segment.startTime / ride.duration) * 100
              const width = ((segment.endTime - segment.startTime) / ride.duration) * 100
              
              return (
                <div
                  key={`idle-${i}`}
                  className="absolute inset-y-0 bg-slate-600/60"
                  style={{
                    left: `${startPercent}%`,
                    width: `${width}%`,
                  }}
                >
                  {/* Diagonal stripes pattern for idle */}
                  <div 
                    className="h-full w-full opacity-30"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Time Display */}
          <div className="flex-shrink-0 text-sm font-medium tabular-nums text-white/80">
            {formatTime(clampedTime)} / {formatTime(ride.duration)}
          </div>
        </div>

        {/* Current segment indicator */}
        {currentSegment && (
          <div className="mt-2 text-center text-xs text-white/60">
            {currentSegment.type === 'skiing' && (
              <span className="inline-flex items-center gap-1">
                <span 
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: getSegmentColor(currentSegment) }}
                />
                {currentSegment.pisteName || 'Skiing'}
              </span>
            )}
            {currentSegment.type === 'lift' && (
              <span className="inline-flex items-center gap-1">
                🚡 Lift
              </span>
            )}
            {currentSegment.type === 'idle' && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                ⏸ Paused
              </span>
            )}
          </div>
        )}

        {/* Bottom row: Speed selector, Skip toggle, Audio toggle, Camera follow toggle */}
        <div className="mt-3 flex items-center justify-between">
          {/* Left side: Speed Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              {playbackSpeed}x
              <ChevronDown
                className={`h-4 w-4 transition-transform ${speedDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Speed Dropdown */}
            {speedDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 max-h-48 overflow-y-auto overflow-hidden rounded-lg border border-white/10 bg-black/90 shadow-xl backdrop-blur-md">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed)
                      setSpeedDropdownOpen(false)
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-blue-500/30 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center controls group */}
          <div className="flex items-center gap-2">
            {/* Skip Idle Toggle */}
            <button
              onClick={toggleSkipIdle}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                skipIdleEnabled
                  ? 'bg-amber-500/30 text-amber-400'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
              title={skipIdleEnabled ? 'Disable skip idle' : 'Enable skip idle (auto-skip pauses)'}
            >
              <FastForward className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Skip Idle</span>
            </button>

          </div>

          {/* Right side: Camera Follow Toggle */}
          <button
            onClick={toggleCameraFollow}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              cameraFollowEnabled
                ? 'bg-blue-500/30 text-blue-400'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
            title={cameraFollowEnabled ? 'Disable camera follow' : 'Enable camera follow'}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Follow</span>
          </button>
        </div>
      </div>
    </div>
  )
}
