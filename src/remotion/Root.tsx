import { Composition, Folder } from 'remotion'
import { SkiRunVideo, type SkiRunVideoProps } from './compositions/SkiRunVideo'
import { SkiRunHighlight, type SkiRunHighlightProps } from './compositions/SkiRunHighlight'
import { createDemoVideoRun } from '@/types/skiRun'

// Video configuration constants
export const FPS = 30
export const VIDEO_WIDTH = 1920
export const VIDEO_HEIGHT = 1080

// Default duration in frames (1 minute at 30fps)
const DEFAULT_DURATION_FRAMES = FPS * 60

// Default demo run props for Remotion Studio preview
const defaultRunProps: SkiRunVideoProps = {
  run: createDemoVideoRun(),
}

/**
 * Remotion Root - Registers all video compositions
 */
export function RemotionRoot() {
  return (
    <Folder name="SkiRuns">
      <Composition
        id="SkiRunVideo"
        component={SkiRunVideo}
        durationInFrames={DEFAULT_DURATION_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultRunProps}
      />
      <Composition
        id="SkiRunHighlight"
        component={SkiRunHighlight}
        durationInFrames={FPS * 15} // 15 seconds
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultRunProps satisfies SkiRunHighlightProps}
      />
    </Folder>
  )
}
