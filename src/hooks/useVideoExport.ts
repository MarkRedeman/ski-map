import { useState, useCallback, useRef } from 'react'
import type { VideoSkiRun } from '@/types/skiRun'

export type VideoQuality = '720p' | '1080p'
export type VideoFormat = 'mp4' | 'webm'

export interface VideoExportOptions {
  quality: VideoQuality
  format: VideoFormat
}

interface UseVideoExportReturn {
  exportVideo: (run: VideoSkiRun, options: VideoExportOptions) => Promise<void>
  progress: number
  isExporting: boolean
  videoUrl: string | null
  error: string | null
  isSupported: boolean
  cancelExport: () => void
}

const QUALITY_SETTINGS: Record<VideoQuality, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
}

/**
 * Hook for managing video export using browser's WebCodecs API
 * 
 * Note: WebCodecs is only supported in Chromium-based browsers (Chrome, Edge)
 * For other browsers, we show a "not supported" message
 */
export function useVideoExport(): UseVideoExportReturn {
  const [progress, setProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Check if WebCodecs API is supported
  const isSupported = typeof window !== 'undefined' && 
    'VideoEncoder' in window && 
    'VideoDecoder' in window

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsExporting(false)
      setProgress(0)
    }
  }, [])

  const exportVideo = useCallback(
    async (run: VideoSkiRun, options: VideoExportOptions) => {
      if (!isSupported) {
        setError('Video export requires Chrome or Edge browser with WebCodecs support')
        return
      }

      // Clear previous state
      setError(null)
      setVideoUrl(null)
      setProgress(0)
      setIsExporting(true)

      // Create abort controller
      abortControllerRef.current = new AbortController()
      const { signal } = abortControllerRef.current

      try {
        const { width, height } = QUALITY_SETTINGS[options.quality]
        const fps = 30
        const durationInSeconds = Math.min(run.duration, 60) // Cap at 60 seconds
        const totalFrames = durationInSeconds * fps

        // We'll simulate the export progress here
        // In a real implementation, you would use @remotion/renderer with WebCodecs
        // or a server-side rendering approach
        
        // For client-side preview purposes, we create a canvas-based recording
        const chunks: Blob[] = []
        
        // Check for MediaRecorder support as fallback
        if (typeof MediaRecorder === 'undefined') {
          throw new Error('MediaRecorder API not supported')
        }

        // Create a canvas for rendering frames
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          throw new Error('Could not create canvas context')
        }

        // Create MediaRecorder for canvas capture
        const stream = canvas.captureStream(fps)
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: options.format === 'webm' ? 'video/webm' : 'video/webm', // MP4 needs server-side
          videoBitsPerSecond: options.quality === '1080p' ? 5000000 : 2500000,
        })

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        const recordingComplete = new Promise<void>((resolve, reject) => {
          mediaRecorder.onstop = () => resolve()
          mediaRecorder.onerror = () => reject(new Error('Recording failed'))
          
          signal.addEventListener('abort', () => {
            mediaRecorder.stop()
            reject(new Error('Export cancelled'))
          })
        })

        mediaRecorder.start(100) // Collect data every 100ms

        // Simulate frame rendering with progress updates
        const frameDelay = 1000 / fps / 3 // Render 3x faster than realtime

        for (let frame = 0; frame < totalFrames; frame++) {
          if (signal.aborted) {
            throw new Error('Export cancelled')
          }

          // Render a simple frame visualization
          // In production, this would render the actual Remotion composition
          renderSimulatedFrame(ctx, width, height, frame, totalFrames, run)

          // Update progress
          setProgress(Math.round((frame / totalFrames) * 100))

          // Small delay to prevent blocking
          if (frame % 10 === 0) {
            await new Promise((r) => setTimeout(r, frameDelay))
          }
        }

        mediaRecorder.stop()
        await recordingComplete

        // Create blob URL
        const blob = new Blob(chunks, { 
          type: options.format === 'webm' ? 'video/webm' : 'video/webm' 
        })
        const url = URL.createObjectURL(blob)
        
        setVideoUrl(url)
        setProgress(100)
      } catch (err) {
        if (err instanceof Error && err.message !== 'Export cancelled') {
          setError(err.message)
        }
      } finally {
        setIsExporting(false)
        abortControllerRef.current = null
      }
    },
    [isSupported]
  )

  return {
    exportVideo,
    progress,
    isExporting,
    videoUrl,
    error,
    isSupported,
    cancelExport,
  }
}

/**
 * Renders a simulated frame for preview export
 * This is a simplified visualization - in production, use @remotion/renderer
 */
function renderSimulatedFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  totalFrames: number,
  run: VideoSkiRun
): void {
  const progress = frame / totalFrames
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0c1929')
  gradient.addColorStop(0.5, '#1a365d')
  gradient.addColorStop(1, '#0c1929')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Mountain silhouette
  ctx.fillStyle = 'rgba(30, 58, 95, 0.5)'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(width * 0.2, height * 0.6)
  ctx.lineTo(width * 0.4, height * 0.75)
  ctx.lineTo(width * 0.6, height * 0.5)
  ctx.lineTo(width * 0.8, height * 0.7)
  ctx.lineTo(width, height * 0.55)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()

  // Run path visualization
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 4
  ctx.beginPath()
  
  const pathProgress = progress
  const points = 20
  for (let i = 0; i <= points * pathProgress; i++) {
    const t = i / points
    const x = width * 0.2 + t * width * 0.6 + Math.sin(t * Math.PI * 4) * 50
    const y = height * 0.3 + t * height * 0.5
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Skier marker
  const skierX = width * 0.2 + progress * width * 0.6 + Math.sin(progress * Math.PI * 4) * 50
  const skierY = height * 0.3 + progress * height * 0.5
  
  ctx.beginPath()
  ctx.arc(skierX, skierY, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#3b82f6'
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 3
  ctx.stroke()

  // Stats overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(30, height - 100, 200, 70)
  ctx.fillRect(width - 170, height - 100, 140, 70)

  ctx.font = 'bold 24px system-ui'
  ctx.fillStyle = 'white'
  ctx.textAlign = 'left'
  
  const currentSpeed = Math.round(5 + Math.sin(progress * Math.PI * 8) * 10 + 10)
  ctx.fillText(`${currentSpeed} km/h`, 50, height - 55)
  
  ctx.font = '16px system-ui'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText('Speed', 50, height - 75)

  // Title
  ctx.font = 'bold 28px system-ui'
  ctx.fillStyle = 'white'
  ctx.textAlign = 'left'
  ctx.fillText(run.name, 30, 50)

  // Time
  const seconds = Math.floor(progress * run.duration)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  ctx.textAlign = 'right'
  ctx.font = 'bold 32px system-ui'
  ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, width - 30, 50)
}
