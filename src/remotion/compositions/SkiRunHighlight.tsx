import { AbsoluteFill, Sequence, useVideoConfig, interpolate, useCurrentFrame } from 'remotion'
import type { VideoSkiRun } from '@/types/skiRun'
import { RunScene } from '../components/RunScene'
import { StatsOverlay } from '../components/StatsOverlay'
import { FPS } from '../Root'

export type SkiRunHighlightProps = {
  run: VideoSkiRun
}

/**
 * Short highlight clip (15 seconds)
 * Shows condensed version with faster progression
 */
export function SkiRunHighlight({ run }: SkiRunHighlightProps) {
  const { durationInFrames } = useVideoConfig()
  const frame = useCurrentFrame()

  // Fade in/out
  const fadeIn = interpolate(frame, [0, FPS * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - FPS * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' }
  )

  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c1929', opacity }}>
      {/* Title overlay for first 2 seconds */}
      <Sequence durationInFrames={FPS * 2}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HighlightTitle run={run} />
        </AbsoluteFill>
      </Sequence>

      {/* 3D scene */}
      <Sequence from={FPS} durationInFrames={durationInFrames - FPS} premountFor={FPS}>
        <AbsoluteFill>
          <RunScene run={run} speedMultiplier={run.duration / 13} />
        </AbsoluteFill>
      </Sequence>

      {/* Minimal stats overlay */}
      <Sequence from={FPS * 2} durationInFrames={durationInFrames - FPS * 2.5} premountFor={FPS}>
        <StatsOverlay run={run} compact />
      </Sequence>
    </AbsoluteFill>
  )
}

function HighlightTitle({ run }: { run: VideoSkiRun }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleY = interpolate(frame, [0, fps * 0.5], [50, 0], {
    extrapolateRight: 'clamp',
  })
  
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        transform: `translateY(${titleY}px)`,
        opacity,
        textAlign: 'center',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 72, fontWeight: 700, margin: 0 }}>
        {run.name}
      </h1>
      <p style={{ fontSize: 28, opacity: 0.7, marginTop: 16 }}>
        {formatDate(run.date)} - {run.difficulty.toUpperCase()}
      </p>
    </div>
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
