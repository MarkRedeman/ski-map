/**
 * Merge fragmented piste segments into unified pistes
 *
 * OSM often splits a single ski run into multiple way segments.
 * This module groups segments by piste identity and combines them
 * into single Piste objects with multiple coordinate arrays.
 */

import type { Piste, RawPiste } from './overpass';
import type { Difficulty } from './overpass';

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function distanceMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate length of a single segment in meters
 */
function calculateSegmentLength(coordinates: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!;
    const [lon2, lat2] = coordinates[i]!;
    length += distanceMeters(lon1, lat1, lon2, lat2);
  }
  return length;
}

/**
 * Calculate total length of all segments in meters
 */
function calculateTotalLength(segments: [number, number][][]): number {
  return segments.reduce((total, seg) => total + calculateSegmentLength(seg), 0);
}

/**
 * Group key for merging pistes
 * Pistes with the same key are considered the same piste
 */
function getPisteGroupKey(piste: RawPiste): string {
  const skiAreaId = piste.skiArea?.id ?? 'unknown';
  const name = piste.name.toLowerCase().trim();
  const ref = piste.ref?.toLowerCase().trim() ?? '';
  const difficulty = piste.difficulty;
  // Use ref if available, otherwise use name
  const identifier = ref || name;
  return `${skiAreaId}|${identifier}|${difficulty}`;
}

/**
 * Merge a group of raw piste segments into a single Piste with multi-segment coordinates
 */
function mergeGroup(segments: RawPiste[]): Piste {
  if (segments.length === 0) {
    throw new Error('Cannot merge empty segment group');
  }

  // Use the first segment for metadata (they should all have the same name/ref/difficulty)
  const first = segments[0]!;

  // Collect all coordinates as separate segments
  const allCoordinates: [number, number][][] = segments.map((s) => s.coordinates);

  // Collect all way IDs
  const osmWayIds = segments.map((s) => s.osmWayId);

  // Find start and end points from longest segment (most representative)
  let longestSegment = segments[0]!;
  let longestLength = calculateSegmentLength(longestSegment.coordinates);

  for (const seg of segments) {
    const len = calculateSegmentLength(seg.coordinates);
    if (len > longestLength) {
      longestLength = len;
      longestSegment = seg;
    }
  }

  const firstCoord = longestSegment.coordinates[0]!;
  const lastCoord = longestSegment.coordinates[longestSegment.coordinates.length - 1]!;

  // Generate ID
  const id = osmWayIds.length > 1 ? `piste-merged-${osmWayIds.join('-')}` : `piste-${osmWayIds[0]}`;

  return {
    id,
    name: first.name,
    difficulty: first.difficulty as Difficulty,
    ref: first.ref,
    coordinates: allCoordinates,
    startPoint: [firstCoord[1], firstCoord[0], 0],
    endPoint: [lastCoord[1], lastCoord[0], 0],
    length: calculateTotalLength(allCoordinates),
    skiArea: first.skiArea,
    osmWayIds,
  };
}

/**
 * Main function: merge fragmented piste segments into unified pistes
 *
 * Algorithm:
 * 1. Group pistes by (skiArea + name/ref + difficulty)
 * 2. Merge each group into a single Piste with multiple coordinate segments
 * 3. Return merged pistes sorted by ski area and name
 */
export function mergePisteSegments(rawPistes: RawPiste[]): Piste[] {
  // Group pistes by their merge key
  const groups = new Map<string, RawPiste[]>();

  for (const piste of rawPistes) {
    const key = getPisteGroupKey(piste);
    const group = groups.get(key) ?? [];
    group.push(piste);
    groups.set(key, group);
  }

  // Merge each group into a single piste
  const mergedPistes: Piste[] = [];

  for (const [_key, segments] of groups) {
    const merged = mergeGroup(segments);
    mergedPistes.push(merged);
  }

  // Sort by ski area name, then by piste ref/name
  mergedPistes.sort((a, b) => {
    const areaA = a.skiArea?.name ?? 'zzz'; // Unknown areas last
    const areaB = b.skiArea?.name ?? 'zzz';

    if (areaA !== areaB) {
      // Sölden first
      if (areaA === 'Sölden') return -1;
      if (areaB === 'Sölden') return 1;
      return areaA.localeCompare(areaB);
    }

    // Within same area, sort by ref (numeric) then name
    const refA = a.ref ? parseInt(a.ref, 10) : Infinity;
    const refB = b.ref ? parseInt(b.ref, 10) : Infinity;

    if (!isNaN(refA) && !isNaN(refB) && refA !== refB) {
      return refA - refB;
    }

    return a.name.localeCompare(b.name);
  });

  return mergedPistes;
}
