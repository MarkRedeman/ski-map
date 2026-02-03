import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import type { VideoSkiRun } from '@/types/skiRun'

type IntroSequenceProps = {
  run: VideoSkiRun
}

/**
 * Opening sequence for the video
 * - Fade in from black
 * - Show run name and date
 * - Zoom effect
 * Duration: ~3 seconds (90 frames at 30fps)
 */
export function IntroSequence({ run }: IntroSequenceProps) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Background fade in
  const bgOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  })

  // Title animation
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: fps * 0.3,
  })

  const titleY = interpolate(titleSpring, [0, 1], [60, 0])
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1])

  // Subtitle animation (delayed)
  const subtitleSpring = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: fps * 0.6,
  })

  const subtitleY = interpolate(subtitleSpring, [0, 1], [40, 0])
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1])

  // Stats animation (even more delayed)
  const statsSpring = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: fps * 1,
  })

  const statsScale = interpolate(statsSpring, [0, 1], [0.8, 1])
  const statsOpacity = interpolate(statsSpring, [0, 1], [0, 1])

  // Fade out at the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' }
  )

  // Zoom effect
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
      }}
    >
      {/* Gradient background */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background: 'linear-gradient(180deg, #0c1929 0%, #1a365d 50%, #0c1929 100%)',
          transform: `scale(${zoom})`,
        }}
      />

      {/* Decorative mountain silhouette */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          opacity: bgOpacity * 0.3,
          background: `
            linear-gradient(135deg, transparent 40%, #1e3a5f 40%, #1e3a5f 42%, transparent 42%),
            linear-gradient(225deg, transparent 35%, #1e3a5f 35%, #1e3a5f 38%, transparent 38%),
            linear-gradient(165deg, transparent 50%, #2d4a6f 50%, #2d4a6f 52%, transparent 52%)
          `,
          transform: `scale(${zoom})`,
        }}
      />

      {/* Content container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: 'white',
        }}
      >
        {/* Difficulty badge */}
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            marginBottom: 24,
          }}
        >
          <DifficultyBadge difficulty={run.difficulty} />
        </div>

        {/* Run name */}
        <h1
          style={{
            fontSize: 96,
            fontWeight: 800,
            margin: 0,
            textAlign: 'center',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            letterSpacing: '-0.02em',
          }}
        >
          {run.name}
        </h1>

        {/* Date */}
        <p
          style={{
            fontSize: 28,
            opacity: subtitleOpacity * 0.8,
            margin: '16px 0 0',
            fontWeight: 500,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          {formatDate(run.date)}
        </p>

        {/* Stats preview */}
        <div
          style={{
            display: 'flex',
            gap: 48,
            marginTop: 60,
            transform: `scale(${statsScale})`,
            opacity: statsOpacity,
          }}
        >
          <IntroStat label="Distance" value={formatDistance(run.totalDistance)} />
          <IntroStat label="Elevation Drop" value={`${run.elevationDrop}m`} />
          <IntroStat label="Max Speed" value={`${(run.maxSpeed * 3.6).toFixed(0)} km/h`} />
          <IntroStat label="Duration" value={formatDuration(run.duration)} />
        </div>
      </AbsoluteFill>

      {/* Animated skiing icon */}
      <SkiingIcon frame={frame} fps={fps} fadeOut={fadeOut} />
    </AbsoluteFill>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: 'blue' | 'red' | 'black' }) {
  const colors = {
    blue: { bg: '#3b82f6', text: 'white' },
    red: { bg: '#ef4444', text: 'white' },
    black: { bg: '#1e293b', text: 'white' },
  }

  const labels = {
    blue: 'Blue Run',
    red: 'Red Run',
    black: 'Black Diamond',
  }

  const style = colors[difficulty]

  return (
    <div
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: '8px 24px',
        borderRadius: 100,
        fontSize: 18,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
    >
      {labels[difficulty]}
    </div>
  )
}

function IntroStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, opacity: 0.6, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function SkiingIcon({ frame, fps, fadeOut }: { frame: number; fps: number; fadeOut: number }) {
  const bounce = Math.sin(frame * 0.2) * 5
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 0.3], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 60,
        fontSize: 64,
        opacity: opacity * fadeOut,
        transform: `translateY(${bounce}px)`,
      }}
    >
      🎿
    </div>
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${meters}m`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) {
    return `${secs}s`
  }
  return `${mins}m ${secs}s`
}
