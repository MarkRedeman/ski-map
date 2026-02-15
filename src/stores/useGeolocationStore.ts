import { create } from 'zustand';

interface GeolocationState {
  // User location / geolocation
  userLocation: [number, number, number] | null; // [lat, lon, elevation]
  setUserLocation: (location: [number, number, number] | null) => void;
  userAccuracy: number | null; // GPS accuracy in meters
  setUserAccuracy: (accuracy: number | null) => void;
  userHeading: number | null; // Device heading in degrees (0 = north)
  setUserHeading: (heading: number | null) => void;
  isTrackingLocation: boolean;
  setIsTrackingLocation: (tracking: boolean) => void;
}

export const useGeolocationStore = create<GeolocationState>()((set) => ({
  userLocation: null,
  setUserLocation: (location) => set({ userLocation: location }),

  userAccuracy: null,
  setUserAccuracy: (accuracy) => set({ userAccuracy: accuracy }),

  userHeading: null,
  setUserHeading: (heading) => set({ userHeading: heading }),

  isTrackingLocation: false,
  setIsTrackingLocation: (tracking) => set({ isTrackingLocation: tracking }),
}));
