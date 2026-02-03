import { createFileRoute, Link } from '@tanstack/react-router'
import { Player } from '@remotion/player'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useRunsStore } from '@/stores/useRunsStore'
import { SkiRunVideo } from '@/remotion/compositions/SkiRunVideo'
import { VideoExporter } from '@/components/runs/VideoExporter'
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '@/remotion/Root'
import { toVideoSkiRun } from '@/types/skiRun'

export const Route = createFileRoute('/runs/video/$runId')({
  component: VideoPage,
})

function VideoPage() {
  const { runId } = Route.useParams()
  const garminRun = useRunsStore((state) => state.runs.find((r) => r.id === runId))

  // Convert to VideoSkiRun format for Remotion
  const videoRun = useMemo(() => {
    if (!garminRun) return null
    return toVideoSkiRun(garminRun)
  }, [garminRun])

  if (!garminRun || !videoRun) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 size-12 text-red-500" />
          <h2 className="text-xl font-semibold text-red-900">Run Not Found</h2>
          <p className="mt-2 text-red-700">
            The ski run with ID "{runId}" could not be found.
          </p>
          <Link
            to="/runs"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
          >
            <ArrowLeft className="size-4" />
            Back to Runs
          </Link>
        </div>
      </div>
    )
  }

  // Calculate video duration based on run duration
  const durationInFrames = Math.max(FPS * 10, Math.ceil(videoRun.duration * FPS / 2)) // Half speed, min 10 seconds

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            to="/runs"
            className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {videoRun.name} - Video
            </h1>
            <p className="text-slate-500">
              Preview and export your ski run video
            </p>
          </div>
        </div>

        {/* Remotion Player Preview */}
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-black shadow-lg">
          <Player
            component={SkiRunVideo}
            inputProps={{ run: videoRun }}
            durationInFrames={durationInFrames}
            fps={FPS}
            compositionWidth={VIDEO_WIDTH}
            compositionHeight={VIDEO_HEIGHT}
            style={{
              width: '100%',
              aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}`,
            }}
            controls
            autoPlay={false}
            loop
          />
        </div>

        {/* Run stats summary */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Distance"
            value={`${(videoRun.totalDistance / 1000).toFixed(1)} km`}
          />
          <StatCard
            label="Elevation Drop"
            value={`${videoRun.elevationDrop}m`}
          />
          <StatCard
            label="Max Speed"
            value={`${(videoRun.maxSpeed * 3.6).toFixed(0)} km/h`}
          />
          <StatCard
            label="Duration"
            value={formatDuration(videoRun.duration)}
          />
        </div>

        {/* Export controls */}
        <VideoExporter run={videoRun} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) {
    return `${secs}s`
  }
  return `${mins}m ${secs}s`
}
