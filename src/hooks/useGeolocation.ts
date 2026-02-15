import { useCallback, useEffect, useRef, useState } from 'react';
import { useGeolocationStore } from '@/stores/useGeolocationStore';

export interface GeolocationError {
  code: number;
  message: string;
}

export interface GeolocationState {
  isTracking: boolean;
  error: GeolocationError | null;
  accuracy: number | null;
  heading: number | null;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

/**
 * Custom hook for GPS location tracking using the browser's Geolocation API.
 * Updates the Zustand navigation store with the user's position.
 */
export function useGeolocation(): GeolocationState & {
  startTracking: () => void;
  stopTracking: () => void;
} {
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);

  const {
    setUserLocation,
    setUserAccuracy,
    setUserHeading,
    userAccuracy,
    userHeading,
    isTrackingLocation,
    setIsTrackingLocation,
  } = useGeolocationStore();

  const handlePositionSuccess = useCallback(
    (position: GeolocationPosition) => {
      const {
        latitude,
        longitude,
        altitude,
        accuracy: posAccuracy,
        heading: posHeading,
      } = position.coords;

      // Update location in store [lat, lon, elevation]
      // Default to 0 if altitude is not available
      setUserLocation([latitude, longitude, altitude ?? 0]);

      // Update accuracy in store (in meters)
      setUserAccuracy(posAccuracy);

      // Update heading if available (in degrees, 0 = north)
      if (posHeading !== null && !isNaN(posHeading)) {
        setUserHeading(posHeading);
      }

      // Clear any previous errors on successful position
      setError(null);
    },
    [setUserLocation, setUserAccuracy, setUserHeading]
  );

  const handlePositionError = useCallback((positionError: GeolocationPositionError) => {
    let message: string;

    switch (positionError.code) {
      case positionError.PERMISSION_DENIED:
        message =
          'Location permission denied. Please enable location access in your browser settings.';
        break;
      case positionError.POSITION_UNAVAILABLE:
        message = 'Location information is unavailable. Please check your GPS settings.';
        break;
      case positionError.TIMEOUT:
        message = 'Location request timed out. Please try again.';
        break;
      default:
        message = 'An unknown error occurred while getting your location.';
    }

    setError({
      code: positionError.code,
      message,
    });
  }, []);

  const startTracking = useCallback(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Reset error state
    setError(null);

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      GEOLOCATION_OPTIONS
    );

    setIsTrackingLocation(true);
  }, [handlePositionSuccess, handlePositionError, setIsTrackingLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTrackingLocation(false);
    setUserLocation(null);
    setUserAccuracy(null);
    setUserHeading(null);
    setError(null);
  }, [setIsTrackingLocation, setUserLocation, setUserAccuracy, setUserHeading]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    isTracking: isTrackingLocation,
    error,
    accuracy: userAccuracy,
    heading: userHeading,
    startTracking,
    stopTracking,
  };
}
