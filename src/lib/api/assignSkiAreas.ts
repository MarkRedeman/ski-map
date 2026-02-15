/**
 * Spatial assignment of ski areas to pistes and lifts
 *
 * Uses point-in-polygon tests to determine which ski area each piste/lift belongs to.
 * Falls back to nearest ski area (by centroid distance) for items outside all polygons.
 */

import {
  pointInPolygon,
  distanceBetweenPoints,
  getFirstCoordinate,
} from '@/lib/geo/pointInPolygon';
import type { RawPiste, Lift, SkiArea, SkiAreaPolygon } from './overpass';

export interface AssignmentResult {
  pistes: RawPiste[];
  lifts: Lift[];
  stats: {
    pistesInPolygon: number;
    pistesNearestFallback: number;
    pistesUnassigned: number;
    liftsInPolygon: number;
    liftsNearestFallback: number;
    liftsUnassigned: number;
  };
}

/**
 * Find which ski area a point belongs to using spatial containment
 *
 * @param point - [lon, lat] coordinate to test
 * @param skiAreaPolygons - Array of ski areas with polygon boundaries
 * @returns The containing SkiArea, or null if outside all polygons
 */
function findContainingSkiArea(
  point: [number, number],
  skiAreaPolygons: SkiAreaPolygon[]
): SkiAreaPolygon | null {
  for (const skiArea of skiAreaPolygons) {
    if (pointInPolygon(point, skiArea.polygon)) {
      return skiArea;
    }
  }
  return null;
}

/**
 * Find the nearest ski area to a point using centroid distance
 *
 * @param point - [lon, lat] coordinate
 * @param skiAreaPolygons - Array of ski areas with centroids
 * @returns The nearest SkiArea, or null if no ski areas available
 */
function findNearestSkiArea(
  point: [number, number],
  skiAreaPolygons: SkiAreaPolygon[]
): SkiAreaPolygon | null {
  if (skiAreaPolygons.length === 0) return null;

  let nearest: SkiAreaPolygon | null = null;
  let minDistance = Infinity;

  for (const skiArea of skiAreaPolygons) {
    const distance = distanceBetweenPoints(point, skiArea.centroid);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = skiArea;
    }
  }

  return nearest;
}

/**
 * Convert SkiAreaPolygon to SkiArea (without polygon data)
 */
function toSkiArea(skiAreaPolygon: SkiAreaPolygon): SkiArea {
  return {
    id: skiAreaPolygon.id,
    name: skiAreaPolygon.name,
    url: skiAreaPolygon.url,
  };
}

/**
 * Assign ski areas to pistes and lifts based on spatial containment
 *
 * Algorithm:
 * 1. For each piste/lift, get its first coordinate (start point)
 * 2. Test if the point is inside any ski area polygon
 * 3. If inside, assign that ski area
 * 4. If outside all polygons, assign to nearest ski area by centroid distance
 *
 * @param pistes - Raw pistes (before segment merging)
 * @param lifts - Lift data
 * @param skiAreaPolygons - Ski areas with polygon boundaries
 * @returns Pistes and lifts with ski area assignments
 */
export function assignSkiAreas(
  pistes: RawPiste[],
  lifts: Lift[],
  skiAreaPolygons: SkiAreaPolygon[]
): AssignmentResult {
  const stats = {
    pistesInPolygon: 0,
    pistesNearestFallback: 0,
    pistesUnassigned: 0,
    liftsInPolygon: 0,
    liftsNearestFallback: 0,
    liftsUnassigned: 0,
  };

  // Assign ski areas to pistes
  const assignedPistes = pistes.map((piste) => {
    const firstCoord = getFirstCoordinate(piste.coordinates);

    if (!firstCoord) {
      stats.pistesUnassigned++;
      return piste;
    }

    // Try spatial containment first
    let skiAreaPolygon = findContainingSkiArea(firstCoord, skiAreaPolygons);

    if (skiAreaPolygon) {
      stats.pistesInPolygon++;
    } else {
      // Fallback to nearest ski area
      skiAreaPolygon = findNearestSkiArea(firstCoord, skiAreaPolygons);
      if (skiAreaPolygon) {
        stats.pistesNearestFallback++;
      } else {
        stats.pistesUnassigned++;
      }
    }

    if (skiAreaPolygon) {
      return {
        ...piste,
        skiArea: toSkiArea(skiAreaPolygon),
      };
    }

    return piste;
  });

  // Assign ski areas to lifts
  const assignedLifts = lifts.map((lift) => {
    const firstCoord = getFirstCoordinate(lift.coordinates);

    if (!firstCoord) {
      stats.liftsUnassigned++;
      return lift;
    }

    // Try spatial containment first
    let skiAreaPolygon = findContainingSkiArea(firstCoord, skiAreaPolygons);

    if (skiAreaPolygon) {
      stats.liftsInPolygon++;
    } else {
      // Fallback to nearest ski area
      skiAreaPolygon = findNearestSkiArea(firstCoord, skiAreaPolygons);
      if (skiAreaPolygon) {
        stats.liftsNearestFallback++;
      } else {
        stats.liftsUnassigned++;
      }
    }

    if (skiAreaPolygon) {
      return {
        ...lift,
        skiArea: toSkiArea(skiAreaPolygon),
      };
    }

    return lift;
  });

  console.log('[SkiAreas] Assignment stats:', stats);

  return {
    pistes: assignedPistes,
    lifts: assignedLifts,
    stats,
  };
}
