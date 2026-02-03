import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import type { VideoSkiRun } from '@/types/skiRun'
import { IntroSequence } from '../components/IntroSequence'
import { RunScene } from '../components/RunScene'
import { StatsOverlay } from '../components/StatsOverlay'
import { FPS } from '../Root'

export type SkiRunVideoProps = {
  run: VideoSkiRun
}

// Intro duration in frames (3 seconds)
const INTRO_DURATION = FPS * 3

/**
 * Main ski run video composition
 * Shows intro sequence, then 3D replay with stats overlay
 */
export function SkiRunVideo({ run }: SkiRunVideoProps) {
  const { durationInFrames } = useVideoConfig()
  
  // Calculate main content duration (after intro)
  const mainDuration = durationInFrames - INTRO_DURATION

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c1929' }}>
      {/* Intro sequence - first 3 seconds */}
      <Sequence durationInFrames={INTRO_DURATION} premountFor={10}>
        <IntroSequence run={run} />
      </Sequence>

      {/* Main 3D scene with run replay */}
      <Sequence from={INTRO_DURATION} durationInFrames={mainDuration} premountFor={FPS}>
        <AbsoluteFill>
          <RunScene run={run} />
        </AbsoluteFill>
      </Sequence>

      {/* Stats overlay appears after intro */}
      <Sequence from={INTRO_DURATION} durationInFrames={mainDuration} premountFor={FPS}>
        <StatsOverlay run={run} />
      </Sequence>
    </AbsoluteFill>
  )
}
