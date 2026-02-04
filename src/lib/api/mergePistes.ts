/**
 * Merge fragmented piste segments into unified pistes
 * 
 * OSM often splits a single ski run into multiple way segments.
 * This module detects connected segments and merges them into single pistes.
 */

import type { Piste, RawPiste } from './overpass'

/** Maximum distance in meters to consider two endpoints connected */
const CONNECTION_THRESHOLD_METERS = 50

/** Maximum distance to consider an endpoint touching a line segment */
const LINE_PROXIMITY_THRESHOLD_METERS = 30

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function distanceMeters(
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get start and end coordinates of a piste segment
 */
function getEndpoints(piste: RawPiste): {
  start: [number, number]
  end: [number, number]
} {
  const coords = piste.coordinates
  return {
    start: coords[0]!,
    end: coords[coords.length - 1]!,
  }
}

/**
 * Check if two coordinates are within the connection threshold
 */
function areConnected(
  coord1: [number, number],
  coord2: [number, number]
): boolean {
  const distance = distanceMeters(coord1[0], coord1[1], coord2[0], coord2[1])
  return distance <= CONNECTION_THRESHOLD_METERS
}

/**
 * Check if a point is close to any point along a line (polyline)
 * Returns the index of the closest point if within threshold, or -1 if not
 */
function findClosestPointOnLine(
  point: [number, number],
  line: [number, number][],
  threshold: number = LINE_PROXIMITY_THRESHOLD_METERS
): number {
  let minDist = Infinity
  let closestIdx = -1
  
  for (let i = 0; i < line.length; i++) {
    const dist = distanceMeters(point[0], point[1], line[i]![0], line[i]![1])
    if (dist < minDist) {
      minDist = dist
      closestIdx = i
    }
  }
  
  return minDist <= threshold ? closestIdx : -1
}

/**
 * Group key for merging pistes
 * Pistes with the same key can potentially be merged
 */
function getPisteGroupKey(piste: RawPiste): string {
  const skiAreaId = piste.skiArea?.id ?? 'unknown'
  const name = piste.name.toLowerCase().trim()
  const ref = piste.ref?.toLowerCase().trim() ?? ''
  const difficulty = piste.difficulty
  // Use ref if available, otherwise use name
  const identifier = ref || name
  return `${skiAreaId}|${identifier}|${difficulty}`
}

/**
 * Reverse coordinates of a segment
 */
function reverseCoordinates(coords: [number, number][]): [number, number][] {
  return [...coords].reverse()
}

/**
 * Build a connected chain from a group of segments
 * Uses a greedy approach to connect segments by:
 * 1. Endpoint-to-endpoint connections (primary)
 * 2. Endpoint touching line (for branch merging)
 */
function buildConnectedChain(segments: RawPiste[]): {
  mergedCoordinates: [number, number][]
  mergedWayIds: number[]
  usedIndices: Set<number>
} {
  if (segments.length === 0) {
    return { mergedCoordinates: [], mergedWayIds: [], usedIndices: new Set() }
  }
  
  if (segments.length === 1) {
    return {
      mergedCoordinates: segments[0]!.coordinates,
      mergedWayIds: [segments[0]!.osmWayId],
      usedIndices: new Set([0]),
    }
  }
  
  // Start with the longest segment (more likely to be the main path)
  let longestIdx = 0
  let longestLen = 0
  for (let i = 0; i < segments.length; i++) {
    const len = segments[i]!.coordinates.length
    if (len > longestLen) {
      longestLen = len
      longestIdx = i
    }
  }
  
  let currentCoords = [...segments[longestIdx]!.coordinates]
  const usedIndices = new Set<number>([longestIdx])
  const mergedWayIds = [segments[longestIdx]!.osmWayId]
  
  // Keep trying to extend the chain
  let extended = true
  while (extended) {
    extended = false
    
    for (let i = 0; i < segments.length; i++) {
      if (usedIndices.has(i)) continue
      
      const segment = segments[i]!
      const segEndpoints = getEndpoints(segment)
      
      // Check if this segment connects to the current chain's end
      const chainEnd = currentCoords[currentCoords.length - 1]!
      const chainStart = currentCoords[0]!
      
      // Try endpoint-to-endpoint connections first (most reliable)
      if (areConnected(chainEnd, segEndpoints.start)) {
        currentCoords = [...currentCoords, ...segment.coordinates.slice(1)]
        usedIndices.add(i)
        mergedWayIds.push(segment.osmWayId)
        extended = true
        break
      }
      
      if (areConnected(chainEnd, segEndpoints.end)) {
        currentCoords = [...currentCoords, ...reverseCoordinates(segment.coordinates).slice(1)]
        usedIndices.add(i)
        mergedWayIds.push(segment.osmWayId)
        extended = true
        break
      }
      
      if (areConnected(chainStart, segEndpoints.end)) {
        currentCoords = [...segment.coordinates, ...currentCoords.slice(1)]
        usedIndices.add(i)
        mergedWayIds.unshift(segment.osmWayId)
        extended = true
        break
      }
      
      if (areConnected(chainStart, segEndpoints.start)) {
        currentCoords = [...reverseCoordinates(segment.coordinates), ...currentCoords.slice(1)]
        usedIndices.add(i)
        mergedWayIds.unshift(segment.osmWayId)
        extended = true
        break
      }
      
      // Try line proximity connections (for branches that merge into main path)
      // Check if segment's start or end touches somewhere along the chain
      const startOnChain = findClosestPointOnLine(segEndpoints.start, currentCoords)
      const endOnChain = findClosestPointOnLine(segEndpoints.end, currentCoords)
      
      if (startOnChain !== -1 && startOnChain > 0 && startOnChain < currentCoords.length - 1) {
        // Segment starts on the chain - it's a branch that joins
        // Just absorb this segment into the merged piste (don't add coordinates
        // since it would create a branch, but count it as part of this piste)
        usedIndices.add(i)
        mergedWayIds.push(segment.osmWayId)
        extended = true
        break
      }
      
      if (endOnChain !== -1 && endOnChain > 0 && endOnChain < currentCoords.length - 1) {
        // Segment ends on the chain - it's a branch that joins
        usedIndices.add(i)
        mergedWayIds.push(segment.osmWayId)
        extended = true
        break
      }
    }
  }
  
  return { mergedCoordinates: currentCoords, mergedWayIds, usedIndices }
}

/**
 * Merge a group of piste segments that should be the same piste
 * Returns one or more merged pistes (multiple if there are disconnected parts)
 */
function mergeGroup(segments: RawPiste[]): Piste[] {
  if (segments.length === 0) return []
  
  if (segments.length === 1) {
    const seg = segments[0]!
    return [{
      id: seg.id,
      name: seg.name,
      difficulty: seg.difficulty,
      ref: seg.ref,
      coordinates: seg.coordinates,
      startPoint: seg.startPoint,
      endPoint: seg.endPoint,
      skiArea: seg.skiArea,
      osmWayIds: [seg.osmWayId],
    }]
  }
  
  const result: Piste[] = []
  const remainingIndices = new Set(segments.map((_, i) => i))
  
  // Keep building chains until all segments are used
  while (remainingIndices.size > 0) {
    const remainingSegments = Array.from(remainingIndices).map(i => segments[i]!)
    const { mergedCoordinates, mergedWayIds, usedIndices } = buildConnectedChain(remainingSegments)
    
    // Map used indices back to original indices
    const originalUsedIndices = Array.from(usedIndices).map(
      localIdx => Array.from(remainingIndices)[localIdx]!
    )
    
    // Remove used indices from remaining
    for (const idx of originalUsedIndices) {
      remainingIndices.delete(idx)
    }
    
    if (mergedCoordinates.length > 0) {
      const firstSeg = segments[originalUsedIndices[0]!]!
      const firstCoord = mergedCoordinates[0]!
      const lastCoord = mergedCoordinates[mergedCoordinates.length - 1]!
      
      // Generate a unique ID for merged pistes
      const id = mergedWayIds.length > 1
        ? `piste-merged-${mergedWayIds.join('-')}`
        : `piste-${mergedWayIds[0]}`
      
      result.push({
        id,
        name: firstSeg.name,
        difficulty: firstSeg.difficulty,
        ref: firstSeg.ref,
        coordinates: mergedCoordinates,
        startPoint: [firstCoord[1], firstCoord[0], 0],
        endPoint: [lastCoord[1], lastCoord[0], 0],
        skiArea: firstSeg.skiArea,
        osmWayIds: mergedWayIds,
      })
    }
  }
  
  return result
}

/**
 * Calculate approximate length from coordinates in meters
 */
function calculateLength(coordinates: [number, number][]): number {
  let length = 0
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]!
    const [lon2, lat2] = coordinates[i]!
    length += distanceMeters(lon1, lat1, lon2, lat2)
  }
  return length
}

/**
 * Main function: merge fragmented piste segments into unified pistes
 * 
 * Algorithm:
 * 1. Group pistes by (skiArea + name/ref + difficulty)
 * 2. For each group, build connected chains from segments
 * 3. Return merged pistes sorted by ski area and name
 */
export function mergePisteSegments(rawPistes: RawPiste[]): Piste[] {
  // Group pistes by their merge key
  const groups = new Map<string, RawPiste[]>()
  
  for (const piste of rawPistes) {
    const key = getPisteGroupKey(piste)
    const group = groups.get(key) ?? []
    group.push(piste)
    groups.set(key, group)
  }
  
  // Merge each group
  const mergedPistes: Piste[] = []
  
  for (const [_key, segments] of groups) {
    const merged = mergeGroup(segments)
    mergedPistes.push(...merged)
  }
  
  // Calculate lengths and sort
  for (const piste of mergedPistes) {
    piste.length = calculateLength(piste.coordinates)
  }
  
  // Sort by ski area name, then by piste name
  mergedPistes.sort((a, b) => {
    const areaA = a.skiArea?.name ?? 'zzz' // Unknown areas last
    const areaB = b.skiArea?.name ?? 'zzz'
    
    if (areaA !== areaB) {
      // Sölden first
      if (areaA === 'Sölden') return -1
      if (areaB === 'Sölden') return 1
      return areaA.localeCompare(areaB)
    }
    
    // Within same area, sort by ref (numeric) then name
    const refA = a.ref ? parseInt(a.ref, 10) : Infinity
    const refB = b.ref ? parseInt(b.ref, 10) : Infinity
    
    if (!isNaN(refA) && !isNaN(refB) && refA !== refB) {
      return refA - refB
    }
    
    return a.name.localeCompare(b.name)
  })
  
  return mergedPistes
}
