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
          'flex w-full items-center gap-3 rounded-lg border px-3 py-3 transition-all',
          'hover:shadow-md active:scale-[0.98]',
          error
            ? 'border-red-200 bg-red-50 text-red-700'
            : isTracking
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
        )}
      >
        {/* Icon with pulsing animation when active */}
        <div className="relative">
          {error ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : isTracking ? (
            <>
              <Locate className="h-5 w-5 text-blue-600" />
              {/* Pulsing ring animation */}
              <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-75" />
            </>
          ) : (
            <LocateOff className="h-5 w-5 text-slate-400" />
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
            <div className="text-xs text-blue-500">
              Accuracy: {formatAccuracy(accuracy)} ({Math.round(accuracy)}m)
            </div>
          )}
        </div>

        {/* Toggle indicator */}
        <div
          className={cn(
            'h-4 w-8 rounded-full transition-colors',
            isTracking ? 'bg-blue-500' : 'bg-slate-300'
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
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
          {error.message}
        </div>
      )}

      {/* Info text */}
      {!error && !isTracking && (
        <p className="text-xs text-slate-400">
          Track your location on the map in real-time. Requires GPS access.
        </p>
      )}
    </div>
  )
}
