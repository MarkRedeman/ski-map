import { Locate, LocateOff, AlertCircle, Navigation, MapPinOff } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useGeolocationStore } from '@/stores/useGeolocationStore';
import { useMapStore } from '@/stores/useMapStore';
import { geoToLocal, isInSoldenBounds } from '@/lib/geo/coordinates';
import { cn } from '@/lib/utils';

/**
 * Button component that toggles GPS location tracking on/off.
 * Shows current tracking state, accuracy, error states, and out-of-bounds warning.
 * Includes a "center on me" button to navigate the camera to the user's location.
 */
export function LocationButton() {
  const { isTracking, error, accuracy, startTracking, stopTracking } = useGeolocation();
  const userLocation = useGeolocationStore((s) => s.userLocation);
  const setCameraFocusTarget = useMapStore((s) => s.setCameraFocusTarget);

  // Check if user is within Sölden ski area bounds
  const isInBounds = userLocation ? isInSoldenBounds(userLocation[0], userLocation[1]) : true; // Default to true when no location

  const handleClick = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const handleCenterOnMe = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the main button

    if (!userLocation) return;

    const [lat, lon, elevation] = userLocation;
    const [x, y, z] = geoToLocal(lat, lon, elevation);

    setCameraFocusTarget({
      position: [x, y, z],
      distance: 150, // Zoom in reasonably close
    });
  };

  const formatAccuracy = (meters: number): string => {
    if (meters < 10) return 'Excellent';
    if (meters < 30) return 'Good';
    if (meters < 100) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Main toggle button */}
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-3 rounded px-3 py-2.5 transition-all',
            error
              ? 'bg-red-500/20 text-red-300'
              : isTracking
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          )}
        >
          {/* Icon with pulsing animation when active */}
          <div className="relative">
            {error ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : isTracking ? (
              <>
                <Locate className="h-5 w-5 text-amber-400" />
                {/* Pulsing ring animation */}
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-50" />
              </>
            ) : (
              <LocateOff className="h-5 w-5 text-white/50" />
            )}
          </div>

          {/* Label and status */}
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">
              {error ? 'Location Error' : isTracking ? 'Tracking Active' : 'Enable Location'}
            </span>

            {/* Accuracy indicator when tracking */}
            {isTracking && accuracy !== null && !error && (
              <div className="text-xs text-amber-400">
                Accuracy: {formatAccuracy(accuracy)} ({Math.round(accuracy)}m)
              </div>
            )}
          </div>

          {/* Toggle indicator */}
          <div
            className={cn(
              'h-4 w-8 rounded-full transition-colors',
              isTracking ? 'bg-amber-500' : 'bg-white/20'
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

        {/* Center on me button - only visible when tracking */}
        {isTracking && userLocation && (
          <button
            onClick={handleCenterOnMe}
            className={cn(
              'flex items-center justify-center rounded px-3 transition-all',
              'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            )}
            title="Center map on my location"
          >
            <Navigation className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded bg-red-500/20 p-2 text-xs text-red-300">{error.message}</div>
      )}

      {/* Out of bounds warning */}
      {isTracking && !error && !isInBounds && (
        <div className="flex items-center gap-2 rounded bg-amber-500/20 p-2 text-xs text-amber-300">
          <MapPinOff className="h-4 w-4 flex-shrink-0" />
          <span>You are outside the Sölden ski area</span>
        </div>
      )}

      {/* Info text */}
      {!error && !isTracking && (
        <p className="text-[11px] text-white/40 px-1">
          Track your location on the map in real-time. Requires GPS access.
        </p>
      )}
    </div>
  );
}
