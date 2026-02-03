import { useState, useCallback } from 'react'
import { Download, Loader2, X, AlertCircle, Film, Settings } from 'lucide-react'
import type { VideoSkiRun } from '@/types/skiRun'
import { useVideoExport, type VideoQuality, type VideoFormat } from '@/hooks/useVideoExport'

type VideoExporterProps = {
  run: VideoSkiRun
}

/**
 * Component for exporting ski run videos
 * Handles quality settings, export progress, and download
 */
export function VideoExporter({ run }: VideoExporterProps) {
  const [quality, setQuality] = useState<VideoQuality>('720p')
  const [format, setFormat] = useState<VideoFormat>('webm')
  const [showSettings, setShowSettings] = useState(false)

  const {
    exportVideo,
    progress,
    isExporting,
    videoUrl,
    error,
    isSupported,
    cancelExport,
  } = useVideoExport()

  const handleExport = useCallback(() => {
    exportVideo(run, { quality, format })
  }, [exportVideo, run, quality, format])

  const handleDownload = useCallback(() => {
    if (!videoUrl) return

    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${run.name.replace(/\s+/g, '-').toLowerCase()}-${run.id}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [videoUrl, run, format])

  // Show unsupported message for non-Chrome browsers
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="mt-0.5 size-6 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">
              Browser Not Supported
            </h3>
            <p className="mt-1 text-sm text-amber-700">
              Video export requires Chrome or Edge browser with WebCodecs support.
              Please open this page in Chrome or Microsoft Edge to export videos.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Export controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-100">
              <Film className="size-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Export Video</h3>
              <p className="text-sm text-slate-500">
                Create a shareable video of your run
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Toggle settings"
          >
            <Settings className="size-5" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as VideoQuality)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                disabled={isExporting}
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as VideoFormat)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                disabled={isExporting}
              >
                <option value="webm">WebM</option>
                <option value="mp4">MP4 (via WebM)</option>
              </select>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Progress bar */}
        {isExporting && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Exporting...</span>
              <span className="font-medium text-slate-900">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={cancelExport}
              className="mt-2 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="size-4" />
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-3">
          {!isExporting && !videoUrl && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-sky-700"
            >
              <Film className="size-5" />
              Export Video
            </button>
          )}

          {isExporting && (
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-6 py-2.5 font-medium text-slate-400"
            >
              <Loader2 className="size-5 animate-spin" />
              Exporting...
            </button>
          )}

          {videoUrl && !isExporting && (
            <>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-green-700"
              >
                <Download className="size-5" />
                Download Video
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Film className="size-5" />
                Export Again
              </button>
            </>
          )}
        </div>
      </div>

      {/* Video preview when complete */}
      {videoUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-black shadow-sm">
          <video
            src={videoUrl}
            controls
            className="w-full"
            style={{ aspectRatio: '16 / 9' }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  )
}
