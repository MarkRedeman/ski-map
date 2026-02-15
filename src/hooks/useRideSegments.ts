/**
 * Hook for analyzing ride segments with piste and lift matching
 */

import { useMemo } from 'react';
import { useSkiData } from './useSkiData';
import { analyzeRideSegments, type RideSegment } from '@/lib/garmin/segments';
import { matchSegmentsToPistes, matchSegmentsToLifts } from '@/lib/garmin/pisteMatch';
import type { SkiRun } from '@/lib/garmin/types';

/**
 * Analyze a ride and return segments with piste/lift info
 */
export function useRideSegments(ride: SkiRun | null): RideSegment[] {
  const { data: skiData } = useSkiData();

  return useMemo(() => {
    if (!ride || ride.coordinates.length < 2) {
      return [];
    }

    // Analyze ride to get segments
    let segments = analyzeRideSegments(ride.coordinates);

    // Match skiing segments to pistes for difficulty colors
    if (skiData?.pistes) {
      segments = matchSegmentsToPistes(segments, ride.coordinates, skiData.pistes);
    }

    // Match lift segments to lifts for type/name
    if (skiData?.lifts) {
      segments = matchSegmentsToLifts(segments, ride.coordinates, skiData.lifts);
    }

    return segments;
  }, [ride, skiData?.pistes, skiData?.lifts]);
}

/**
 * Get idle segments only (for skip functionality)
 */
export function useIdleSegments(ride: SkiRun | null): RideSegment[] {
  const segments = useRideSegments(ride);

  return useMemo(() => {
    return segments.filter((s) => s.type === 'idle');
  }, [segments]);
}
