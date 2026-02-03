/**
 * RunCard component displays a ski run's statistics in a card format
 */

import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Clock,
  MapPin,
  TrendingUp,
  TrendingDown,
  Gauge,
  Activity,
  Trash2,
  Eye,
  Film,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkiRun } from '@/lib/garmin/types'
import {
  formatDuration,
  formatDistance,
  formatSpeed,
  formatElevation,
} from '@/lib/garmin/parser'

interface RunCardProps {
  run: SkiRun
  isSelected?: boolean
  onSelect?: (id: string) => void
  onDelete?: (id: string) => void
  showPreview?: boolean
}

export function RunCard({
  run,
  isSelected = false,
  onSelect,
  onDelete,
  showPreview = true,
}: RunCardProps) {
  // Format date
  const formattedDate = useMemo(() => {
    return run.date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [run.date])
  
  // Generate simple SVG preview of the route
  const previewPath = useMemo(() => {
    if (!showPreview || run.coordinates.length < 2) return null
    return generatePathPreview(run.coordinates)
  }, [run.coordinates, showPreview])
  
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-all',
        isSelected
          ? 'border-sky-500 ring-2 ring-sky-200'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
        onSelect && 'cursor-pointer'
      )}
      onClick={() => onSelect?.(run.id)}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{run.name}</h3>
          <p className="text-sm text-slate-500">{formattedDate}</p>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Video button */}
          <Link
            to="/runs/video/$runId"
            params={{ runId: run.id }}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
            title="Create video"
          >
            <Film className="h-4 w-4" />
          </Link>
          {onSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect(run.id)
              }}
              className={cn(
                'rounded p-1.5 transition-colors',
                isSelected
                  ? 'bg-sky-100 text-sky-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              )}
              title="View on map"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Delete this run?')) {
                  onDelete(run.id)
                }
              }}
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Delete run"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Preview */}
      {previewPath && (
        <div className="mb-3 flex justify-center rounded bg-slate-50 p-2">
          <svg
            viewBox="0 0 100 60"
            className="h-12 w-full max-w-[200px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d={previewPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-sky-500"
            />
            {/* Start point */}
            <circle
              cx={previewPath.split(' ')[0]?.slice(1) ?? '0'}
              cy={previewPath.split(' ')[1] ?? '0'}
              r="3"
              className="fill-green-500"
            />
          </svg>
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <StatItem
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Duration"
          value={formatDuration(run.duration)}
        />
        <StatItem
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Distance"
          value={formatDistance(run.distance)}
        />
        <StatItem
          icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />}
          label="Gain"
          value={formatElevation(run.elevationGain)}
        />
        <StatItem
          icon={<TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          label="Loss"
          value={formatElevation(run.elevationLoss)}
        />
        <StatItem
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Max Speed"
          value={formatSpeed(run.maxSpeed)}
        />
        <StatItem
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Avg Speed"
          value={formatSpeed(run.avgSpeed)}
        />
      </div>
    </div>
  )
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex items-center gap-1.5 text-slate-600">
      {icon}
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

/**
 * Generate an SVG path string from coordinates for preview
 */
function generatePathPreview(
  coordinates: Array<{ lat: number; lon: number }>
): string {
  if (coordinates.length < 2) return ''
  
  // Find bounds
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity
  
  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.lat)
    maxLat = Math.max(maxLat, coord.lat)
    minLon = Math.min(minLon, coord.lon)
    maxLon = Math.max(maxLon, coord.lon)
  }
  
  // Add padding
  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001
  const padding = 5
  
  // Scale to fit SVG viewBox (100x60 with padding)
  const scaleX = (90 - padding * 2) / lonRange
  const scaleY = (50 - padding * 2) / latRange
  
  // Sample points to reduce complexity (max 50 points)
  const step = Math.max(1, Math.floor(coordinates.length / 50))
  const sampledCoords = coordinates.filter((_, i) => i % step === 0)
  
  // Build path
  const pathParts: string[] = []
  
  for (let i = 0; i < sampledCoords.length; i++) {
    const coord = sampledCoords[i]
    if (!coord) continue
    const x = padding + (coord.lon - minLon) * scaleX
    // Invert Y since SVG Y increases downward but latitude increases upward
    const y = padding + (maxLat - coord.lat) * scaleY
    
    if (i === 0) {
      pathParts.push(`M${x.toFixed(1)} ${y.toFixed(1)}`)
    } else {
      pathParts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`)
    }
  }
  
  return pathParts.join(' ')
}
