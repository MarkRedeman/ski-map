/**
 * Utility to match ride segments to nearby pistes and lifts for styling
 */

import type { RideSegment } from './segments'
import type { RunPoint } from './types'
import type { Piste, Lift } from '@/lib/api/overpass'
import type { Difficulty } from '@/lib/api/overpass'
import { LIFT_COLORS, DIFFICULTY_COLORS, SEMANTIC } from '@/config/theme'
import type { LiftType } from '@/stores/useMapStore'

// Distance threshold for matching (in meters)
const MATCH_DISTANCE_THRESHOLD = 50

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Find the closest piste to a given point
 */
function findClosestPiste(
  lat: number, 
  lon: number, 
  pistes: Piste[]
): { piste: Piste; distance: number } | null {
  let closestPiste: Piste | null = null
  let minDistance = Infinity
  
  for (const piste of pistes) {
    // Check each segment of the piste
    for (const segment of piste.coordinates) {
      for (const [pisteLon, pisteLat] of segment) {
        const dist = distanceMeters(lat, lon, pisteLat, pisteLon)
        if (dist < minDistance) {
          minDistance = dist
          closestPiste = piste
        }
      }
    }
  }
  
  if (closestPiste && minDistance < MATCH_DISTANCE_THRESHOLD) {
    return { piste: closestPiste, distance: minDistance }
  }
  
  return null
}

/**
 * Find the closest lift to a given point
 */
function findClosestLift(
  lat: number, 
  lon: number, 
  lifts: Lift[]
): { lift: Lift; distance: number } | null {
  let closestLift: Lift | null = null
  let minDistance = Infinity
  
  for (const lift of lifts) {
    // Check each point along the lift line
    for (const [liftLon, liftLat] of lift.coordinates) {
      const dist = distanceMeters(lat, lon, liftLat, liftLon)
      if (dist < minDistance) {
        minDistance = dist
        closestLift = lift
      }
    }
  }
  
  // Lifts have a larger threshold since they're linear and you might be slightly off
  const LIFT_MATCH_THRESHOLD = 80
  if (closestLift && minDistance < LIFT_MATCH_THRESHOLD) {
    return { lift: closestLift, distance: minDistance }
  }
  
  return null
}

/**
 * Match skiing segments to nearby pistes and assign difficulty
 * 
 * For each skiing segment, samples multiple points and finds the most
 * common nearby piste to assign difficulty.
 */
export function matchSegmentsToPistes(
  segments: RideSegment[],
  coordinates: RunPoint[],
  pistes: Piste[]
): RideSegment[] {
  if (!pistes || pistes.length === 0) {
    return segments
  }
  
  return segments.map(segment => {
    // Only match skiing segments
    if (segment.type !== 'skiing') {
      return segment
    }
    
    // Sample points along the segment
    const sampleCount = Math.min(10, segment.endIndex - segment.startIndex + 1)
    const step = Math.max(1, Math.floor((segment.endIndex - segment.startIndex) / sampleCount))
    
    // Count occurrences of each piste
    const pisteCounts = new Map<string, { piste: Piste; count: number }>()
    
    for (let i = segment.startIndex; i <= segment.endIndex; i += step) {
      const point = coordinates[i]
      if (!point) continue
      
      const match = findClosestPiste(point.lat, point.lon, pistes)
      if (match) {
        const existing = pisteCounts.get(match.piste.id)
        if (existing) {
          existing.count++
        } else {
          pisteCounts.set(match.piste.id, { piste: match.piste, count: 1 })
        }
      }
    }
    
    // Find the most common piste
    let bestMatch: { piste: Piste; count: number } | null = null
    for (const match of pisteCounts.values()) {
      if (!bestMatch || match.count > bestMatch.count) {
        bestMatch = match
      }
    }
    
    if (bestMatch) {
      return {
        ...segment,
        difficulty: bestMatch.piste.difficulty,
        pisteName: bestMatch.piste.name || bestMatch.piste.ref || undefined,
      }
    }
    
    // No match found - return without difficulty
    return segment
  })
}

/**
 * Match lift segments to nearby lifts and assign type/name
 * 
 * For each lift segment, samples multiple points and finds the most
 * common nearby lift to assign type and name.
 */
export function matchSegmentsToLifts(
  segments: RideSegment[],
  coordinates: RunPoint[],
  lifts: Lift[]
): RideSegment[] {
  if (!lifts || lifts.length === 0) {
    return segments
  }
  
  return segments.map(segment => {
    // Only match lift segments
    if (segment.type !== 'lift') {
      return segment
    }
    
    // Sample points along the segment
    const sampleCount = Math.min(10, segment.endIndex - segment.startIndex + 1)
    const step = Math.max(1, Math.floor((segment.endIndex - segment.startIndex) / sampleCount))
    
    // Count occurrences of each lift
    const liftCounts = new Map<string, { lift: Lift; count: number }>()
    
    for (let i = segment.startIndex; i <= segment.endIndex; i += step) {
      const point = coordinates[i]
      if (!point) continue
      
      const match = findClosestLift(point.lat, point.lon, lifts)
      if (match) {
        const existing = liftCounts.get(match.lift.id)
        if (existing) {
          existing.count++
        } else {
          liftCounts.set(match.lift.id, { lift: match.lift, count: 1 })
        }
      }
    }
    
    // Find the most common lift
    let bestMatch: { lift: Lift; count: number } | null = null
    for (const match of liftCounts.values()) {
      if (!bestMatch || match.count > bestMatch.count) {
        bestMatch = match
      }
    }
    
    if (bestMatch) {
      return {
        ...segment,
        liftType: bestMatch.lift.type,
        liftName: bestMatch.lift.name || undefined,
      }
    }
    
    // No match found - return without lift info
    return segment
  })
}

/**
 * Get color for a piste difficulty
 */
export function getDifficultyColor(difficulty?: Difficulty): string {
  if (difficulty && difficulty in DIFFICULTY_COLORS) {
    return DIFFICULTY_COLORS[difficulty]
  }
  return SEMANTIC.unknown
}

/**
 * Get a lighter/translucent version of difficulty color for backgrounds
 */
export function getDifficultyColorLight(difficulty?: Difficulty): string {
  switch (difficulty) {
    case 'blue': return 'rgba(59, 130, 246, 0.6)'
    case 'red': return 'rgba(239, 68, 68, 0.6)'
    case 'black': return 'rgba(30, 41, 59, 0.6)'
    default: return 'rgba(107, 114, 128, 0.6)'
  }
}

/**
 * Get segment color based on type, difficulty, and lift type
 */
export function getSegmentColor(segment: RideSegment): string {
  switch (segment.type) {
    case 'skiing':
      return getDifficultyColor(segment.difficulty)
    case 'lift': {
      // Use lift type color if available
      if (segment.liftType) {
        const config = LIFT_COLORS[segment.liftType as LiftType]
        if (config) {
          return config.color
        }
      }
      // Default to amber for unknown lift type
      return LIFT_COLORS['Lift'].color
    }
    case 'idle':
      return SEMANTIC.idle
    default:
      return SEMANTIC.unknown
  }
}
