/**
 * PlaybackManager - Advances playback time and handles end-of-ride logic
 *
 * This component runs inside the R3F Canvas and uses useFrame to advance
 * the playback time based on delta time and playback speed.
 *
 * Also handles auto-skip of idle segments when skipIdleEnabled is true.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useSkiData } from '@/hooks/useSkiData';
import { analyzeRideSegments, findNextActivityTime, type RideSegment } from '@/lib/garmin/segments';
import { matchSegmentsToPistes } from '@/lib/garmin/pisteMatch';
import type { SkiRun } from '@/lib/garmin/types';

interface PlaybackManagerProps {
  ride: SkiRun | null;
}

export function PlaybackManager({ ride }: PlaybackManagerProps) {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const playbackSpeed = usePlaybackStore((s) => s.playbackSpeed);
  const skipIdleEnabled = usePlaybackStore((s) => s.skipIdleEnabled);
  const pause = usePlaybackStore((s) => s.pause);
  const seek = usePlaybackStore((s) => s.seek);

  const { data: skiData } = useSkiData();

  // Cache segments computation
  const segments = useMemo((): RideSegment[] => {
    if (!ride || ride.coordinates.length < 2) {
      return [];
    }

    const rawSegments = analyzeRideSegments(ride.coordinates);

    if (skiData?.pistes) {
      return matchSegmentsToPistes(rawSegments, ride.coordinates, skiData.pistes);
    }

    return rawSegments;
  }, [ride, skiData?.pistes]);

  // Track if we just skipped to avoid infinite loops
  const justSkippedRef = useRef(false);

  useFrame((_, delta) => {
    if (!isPlaying || !ride) return;

    // Advance time
    let newTime = currentTime + delta * playbackSpeed;

    // Check if we should skip idle
    if (skipIdleEnabled && segments.length > 0 && !justSkippedRef.current) {
      const nextActivityTime = findNextActivityTime(segments, newTime);
      if (nextActivityTime !== null && nextActivityTime > newTime) {
        // We're in an idle segment - skip to end of it
        newTime = nextActivityTime;
        justSkippedRef.current = true;
        // Reset the skip flag after a short delay
        setTimeout(() => {
          justSkippedRef.current = false;
        }, 100);
      }
    }

    // Check if we've reached the end
    if (newTime >= ride.duration) {
      // Pause at end (as per requirements)
      seek(ride.duration);
      pause();
    } else {
      seek(newTime);
    }
  });

  return null;
}
