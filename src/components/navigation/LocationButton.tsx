import { Locate, LocateOff, AlertCircle } from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { cn } from '@/lib/utils'

/**
 * Button component that toggles GPS location tracking on/off.
 * Shows current tracking state, accuracy, and error states.
 */
export function LocationButton() {
  const { isTracking, error, accuracy, startTracking, stopTracking } = useGeolocation()

  const handleClick = () => {
    if (isTracking) {
      stopTracking()
    } else {
      startTracking()
    }
  }

  const formatAccuracy = (meters: number): string => {
    if (meters < 10) return 'Excellent'
    if (meters < 30) return 'Good'
    if (meters < 100) return 'Fair'
    return 'Poor'
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-3 rounded px-3 py-2.5 transition-all',
          error
            ? 'bg-red-500/20 text-red-300'
            : isTracking
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
        )}
      >
        {/* Icon with pulsing animation when active */}
        <div className="relative">
          {error ? (
            <AlertCircle className="h-5 w-5 text-red-400" />
          ) : isTracking ? (
            <>
              <Locate className="h-5 w-5 text-blue-400" />
              {/* Pulsing ring animation */}
              <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-50" />
            </>
          ) : (
            <LocateOff className="h-5 w-5 text-white/50" />
          )}
        </div>

        {/* Label and status */}
        <div className="flex-1 text-left">
          <span className="text-sm font-medium">
            {error
              ? 'Location Error'
              : isTracking
                ? 'Tracking Active'
                : 'Enable Location'}
          </span>
          
          {/* Accuracy indicator when tracking */}
          {isTracking && accuracy !== null && !error && (
            <div className="text-xs text-blue-400">
              Accuracy: {formatAccuracy(accuracy)} ({Math.round(accuracy)}m)
            </div>
          )}
        </div>

        {/* Toggle indicator */}
        <div
          className={cn(
            'h-4 w-8 rounded-full transition-colors',
            isTracking ? 'bg-blue-500' : 'bg-white/20'
          )}
        >
          <div
            className={cn(
              'h-4 w-4 rounded-full bg-white shadow transition-transform',
              isTracking ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </div>
      </button>

      {/* Error message */}
      {error && (
        <div className="rounded bg-red-500/20 p-2 text-xs text-red-300">
          {error.message}
        </div>
      )}

      {/* Info text */}
      {!error && !isTracking && (
        <p className="text-[11px] text-white/40 px-1">
          Track your location on the map in real-time. Requires GPS access.
        </p>
      )}
    </div>
  )
}
