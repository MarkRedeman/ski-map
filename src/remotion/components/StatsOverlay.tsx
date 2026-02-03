import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import type { VideoSkiRun } from '@/types/skiRun'
import { getRunValuesAtTime } from '@/types/skiRun'

type StatsOverlayProps = {
  run: VideoSkiRun
  /** Use compact layout for highlight videos */
  compact?: boolean
}

/**
 * Overlay showing run statistics
 * Uses Remotion's interpolate() for smooth number transitions
 */
export function StatsOverlay({ run, compact = false }: StatsOverlayProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Calculate current time and interpolated values
  const timeSeconds = frame / fps
  const runValues = getRunValuesAtTime(run, timeSeconds)

  // Entrance animation
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 200 },
  })

  // Exit animation (last 0.5 seconds)
  const slideOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [0, 50],
    { extrapolateLeft: 'clamp' }
  )

  const opacity = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' }
  )

  // Format time elapsed
  const elapsed = Math.min(timeSeconds, run.duration)
  const minutes = Math.floor(elapsed / 60)
  const seconds = Math.floor(elapsed % 60)
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`

  if (compact) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          display: 'flex',
          gap: 32,
          opacity,
          transform: `translateY(${slideOut}px) translateX(${(1 - slideIn) * -50}px)`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <StatBadge
          label="Speed"
          value={`${runValues.speed.toFixed(0)}`}
          unit="km/h"
        />
        <StatBadge
          label="Alt"
          value={`${Math.round(runValues.elevation)}`}
          unit="m"
        />
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Top left - Run info */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          transform: `translateY(${(1 - slideIn) * -30}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: 12,
            padding: '16px 24px',
            color: 'white',
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
            }}
          >
            {run.name}
          </h2>
          <p
            style={{
              fontSize: 16,
              opacity: 0.7,
              margin: '4px 0 0',
            }}
          >
            {formatDate(run.date)} - {getDifficultyLabel(run.difficulty)}
          </p>
        </div>
      </div>

      {/* Bottom left - Current stats */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          display: 'flex',
          gap: 24,
          transform: `translateY(${(1 - slideIn) * 30 + slideOut}px)`,
        }}
      >
        <StatCard
          icon="🏔️"
          label="Elevation"
          value={Math.round(runValues.elevation).toLocaleString()}
          unit="m"
        />
        <StatCard
          icon="📏"
          label="Distance"
          value={(runValues.distance / 1000).toFixed(2)}
          unit="km"
        />
        <StatCard
          icon="⏱️"
          label="Time"
          value={timeString}
        />
      </div>

      {/* Bottom right - Speed gauge */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          transform: `translateX(${(1 - slideIn) * 50 + slideOut}px)`,
        }}
      >
        <SpeedGauge
          currentSpeed={runValues.speed * 3.6} // m/s to km/h
          maxSpeed={run.maxSpeed * 3.6}
        />
      </div>

      {/* Top right - Time elapsed */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          transform: `translateY(${(1 - slideIn) * -30}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: 12,
            padding: '12px 20px',
            color: 'white',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Elapsed</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {timeString}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: string
  label: string
  value: string
  unit?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        padding: '16px 24px',
        color: 'white',
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function StatBadge({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        padding: '8px 16px',
        color: 'white',
      }}
    >
      <span style={{ opacity: 0.7, fontSize: 14, marginRight: 8 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {unit && (
        <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{unit}</span>
      )}
    </div>
  )
}

function SpeedGauge({
  currentSpeed,
  maxSpeed,
}: {
  currentSpeed: number
  maxSpeed: number
}) {
  const percentage = Math.min(100, (currentSpeed / maxSpeed) * 100)

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        borderRadius: 16,
        padding: 24,
        color: 'white',
        width: 140,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Speed</div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {Math.round(currentSpeed)}
      </div>
      <div style={{ fontSize: 16, opacity: 0.7, marginBottom: 12 }}>km/h</div>
      
      {/* Progress bar */}
      <div
        style={{
          height: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: getSpeedColor(percentage),
            borderRadius: 3,
            transition: 'none', // NO CSS transitions in Remotion!
          }}
        />
      </div>
    </div>
  )
}

function getSpeedColor(percentage: number): string {
  if (percentage < 40) return '#22c55e' // Green
  if (percentage < 70) return '#eab308' // Yellow
  return '#ef4444' // Red
}

function getDifficultyLabel(difficulty: 'blue' | 'red' | 'black'): string {
  const labels = {
    blue: '🔵 Blue',
    red: '🔴 Red',
    black: '⚫ Black',
  }
  return labels[difficulty]
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
