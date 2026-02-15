import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { Suspense, lazy, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarToggle } from '@/components/map/panels/SidebarToggle';
import { PlaybackControls } from '@/components/map/playback/PlaybackControls';
import { useRunsStore } from '@/stores/useRunsStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useMapStore } from '@/stores/useMapStore';
import { useRuns } from '@/hooks/useRuns';
import { searchSchema } from '@/lib/url/searchSchema';
import { useURLSync } from '@/hooks/useURLSync';

// Lazy load the 3D map for better initial load
const SkiMap3D = lazy(() =>
  import('@/components/map/SkiMap3D').then((m) => ({ default: m.SkiMap3D }))
);

// Extend base search schema with ride-specific time parameter
const rideSearchSchema = searchSchema.extend({
  t: z.coerce.number().optional().default(0),
});

export const Route = createFileRoute('/rides/$rideId')({
  validateSearch: zodValidator(rideSearchSchema),
  component: RidePage,
});

function RidePage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { rideId } = Route.useParams();
  const { t } = Route.useSearch();

  // Sync URL search params with stores (for filters/selection)
  useURLSync();

  // Ensure runs are loaded (this also triggers load if not already done)
  const { runs, isLoading } = useRuns();
  const selectRun = useRunsStore((state) => state.selectRun);

  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const seek = usePlaybackStore((state) => state.seek);
  const reset = usePlaybackStore((state) => state.reset);

  // Find the ride
  const ride = runs.find((run) => run.id === rideId);

  // Ref for debouncing URL updates
  const lastUpdateRef = useRef<number>(0);

  // Select ride when it becomes available
  useEffect(() => {
    if (ride) {
      selectRun(rideId);
    }
  }, [rideId, ride, selectRun]);

  // Set initial seek position on mount
  useEffect(() => {
    seek(t);
  }, [t, seek]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      reset();
      selectRun(null);
    };
  }, [reset, selectRun]);

  // Auto-hide pistes and lifts when viewing a ride
  // Restore previous visibility when leaving ride view
  const previousVisibilityRef = useRef<{ pistes: boolean; lifts: boolean } | null>(null);
  const setShowPistes = useMapStore((s) => s.setShowPistes);
  const setShowLifts = useMapStore((s) => s.setShowLifts);

  useEffect(() => {
    // Save current visibility state on mount
    const { showPistes, showLifts } = useMapStore.getState();
    previousVisibilityRef.current = { pistes: showPistes, lifts: showLifts };

    // Hide pistes and lifts to focus on the ride
    setShowPistes(false);
    setShowLifts(false);

    // Restore visibility on unmount
    return () => {
      if (previousVisibilityRef.current) {
        setShowPistes(previousVisibilityRef.current.pistes);
        setShowLifts(previousVisibilityRef.current.lifts);
      }
    };
  }, [setShowPistes, setShowLifts]);

  // Sync playback time with URL (debounced)
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= 500) {
        lastUpdateRef.current = now;
        navigate({
          search: { t: Math.floor(currentTime) },
          replace: true,
        });
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [isPlaying, currentTime, navigate]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-amber-50 to-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">🎿</div>
          <div className="text-lg font-medium text-amber-700">Loading rides...</div>
        </div>
      </div>
    );
  }

  // Handle ride not found
  if (!ride) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-amber-50 to-white">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔍</div>
          <div className="text-lg font-medium text-slate-700">Ride not found</div>
          <div className="mt-2 text-sm text-slate-500">
            The ride you're looking for doesn't exist.
          </div>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar with navigation controls */}
      <Sidebar />

      {/* 3D Map View */}
      <div className="flex-1 relative">
        {/* Sidebar toggle button */}
        <SidebarToggle />

        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-amber-50 to-white">
              <div className="text-center">
                <div className="mb-4 text-4xl">🎿</div>
                <div className="text-lg font-medium text-amber-700">Loading 3D terrain...</div>
                <div className="text-sm text-slate-500">Preparing ski area</div>
              </div>
            </div>
          }
        >
          <SkiMap3D />
        </Suspense>

        {/* Playback Controls Overlay */}
        {ride && <PlaybackControls ride={ride} />}
      </div>
    </div>
  );
}
