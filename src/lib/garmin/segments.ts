/**
 * Segment analysis for ski rides
 * Detects skiing, lift, and idle segments from GPX coordinates
 */

import type { RunPoint } from './types'
import type { Difficulty } from '@/lib/api/overpass'

/** Segment activity types */
export type SegmentType = 'skiing' | 'lift' | 'idle'

/**
 * A segment of continuous activity within a ride
 */
export interface RideSegment {
  type: SegmentType
  startTime: number      // seconds from ride start
  endTime: number        // seconds from ride start
  startIndex: number     // index in coordinates array
  endIndex: number       // index in coordinates array
  difficulty?: Difficulty  // only for skiing segments ('blue' | 'red' | 'black')
  pisteName?: string     // matched piste name if available
  liftType?: string      // only for lift segments (e.g., 'Gondola', 'Chair Lift')
  liftName?: string      // matched lift name if available
  elevationChange: number // total elevation change in segment (negative = downhill)
  distance: number       // total distance in meters
}

// Configuration
const IDLE_SPEED_THRESHOLD = 0.5    // m/s - below this is considered idle
const IDLE_MIN_DURATION = 120       // seconds (2 minutes) - minimum idle duration to mark as skippable
const ELEVATION_WINDOW = 10         // number of points to average for elevation trend
const LIFT_SPEED_MAX = 8            // m/s - lifts rarely go faster than this (~29 km/h)

/**
 * Analyze a ride's coordinates and extract activity segments
 */
export function analyzeRideSegments(coordinates: RunPoint[]): RideSegment[] {
  if (coordinates.length < 2) return []

  const firstPoint = coordinates[0]
  if (!firstPoint) return []
  
  const startTime = firstPoint.time.getTime()
  const segments: RideSegment[] = []
  
  let currentSegment: {
    type: SegmentType
    startIndex: number
    startTime: number
    elevationChange: number
    distance: number
  } | null = null

  for (let i = 0; i < coordinates.length; i++) {
    const point = coordinates[i]
    if (!point) continue
    
    const pointTime = (point.time.getTime() - startTime) / 1000
    
    // Determine activity type for this point
    const activityType = classifyPoint(coordinates, i)
    
    // Calculate distance and elevation from previous point
    let segmentDistance = 0
    let elevationDelta = 0
    if (i > 0) {
      const prevPoint = coordinates[i - 1]
      if (prevPoint) {
        segmentDistance = calculateDistance(prevPoint, point)
        elevationDelta = point.elevation - prevPoint.elevation
      }
    }
    
    if (!currentSegment) {
      // Start first segment
      currentSegment = {
        type: activityType,
        startIndex: i,
        startTime: pointTime,
        elevationChange: 0,
        distance: 0,
      }
    } else if (activityType !== currentSegment.type) {
      // Activity changed - close current segment and start new one
      const endIndex = i - 1
      const endPoint = coordinates[endIndex]
      const endTime = endPoint ? (endPoint.time.getTime() - startTime) / 1000 : pointTime
      
      // Only add segment if it has meaningful duration
      if (endTime - currentSegment.startTime > 1) {
        segments.push({
          type: currentSegment.type,
          startTime: currentSegment.startTime,
          endTime,
          startIndex: currentSegment.startIndex,
          endIndex,
          elevationChange: currentSegment.elevationChange,
          distance: currentSegment.distance,
        })
      }
      
      // Start new segment
      currentSegment = {
        type: activityType,
        startIndex: i,
        startTime: pointTime,
        elevationChange: 0,
        distance: 0,
      }
    }
    
    // Accumulate segment stats
    currentSegment.elevationChange += elevationDelta
    currentSegment.distance += segmentDistance
  }
  
  // Close final segment
  if (currentSegment) {
    const lastPoint = coordinates[coordinates.length - 1]
    const endTime = lastPoint ? (lastPoint.time.getTime() - startTime) / 1000 : 0
    
    segments.push({
      type: currentSegment.type,
      startTime: currentSegment.startTime,
      endTime,
      startIndex: currentSegment.startIndex,
      endIndex: coordinates.length - 1,
      elevationChange: currentSegment.elevationChange,
      distance: currentSegment.distance,
    })
  }
  
  // Post-process: merge very short segments and filter idle segments by duration
  const mergedSegments = mergeShortSegments(segments)
  
  // Mark only idle segments >= 2 minutes as truly idle, rest become their neighbors
  return filterIdleSegments(mergedSegments)
}

/**
 * Classify a single point's activity type based on context
 */
function classifyPoint(coordinates: RunPoint[], index: number): SegmentType {
  const point = coordinates[index]
  if (!point) return 'idle'
  
  const speed = point.speed ?? 0
  
  // Check for idle (very slow movement)
  if (speed < IDLE_SPEED_THRESHOLD) {
    return 'idle'
  }
  
  // Look at elevation trend over a window
  const elevationTrend = getElevationTrend(coordinates, index, ELEVATION_WINDOW)
  
  // If going uphill and not too fast, it's a lift
  if (elevationTrend > 2 && speed < LIFT_SPEED_MAX) {
    return 'lift'
  }
  
  // Otherwise it's skiing (downhill or flat movement)
  return 'skiing'
}

/**
 * Get elevation trend over a window of points
 * Returns positive for uphill, negative for downhill
 */
function getElevationTrend(coordinates: RunPoint[], index: number, windowSize: number): number {
  const halfWindow = Math.floor(windowSize / 2)
  const startIdx = Math.max(0, index - halfWindow)
  const endIdx = Math.min(coordinates.length - 1, index + halfWindow)
  
  const startPoint = coordinates[startIdx]
  const endPoint = coordinates[endIdx]
  
  if (!startPoint || !endPoint) return 0
  
  return endPoint.elevation - startPoint.elevation
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(p1: RunPoint, p2: RunPoint): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (p2.lat - p1.lat) * Math.PI / 180
  const dLon = (p2.lon - p1.lon) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Merge very short segments (< 10 seconds) into adjacent segments
 */
function mergeShortSegments(segments: RideSegment[]): RideSegment[] {
  if (segments.length < 2) return segments
  
  const MIN_SEGMENT_DURATION = 10 // seconds
  const result: RideSegment[] = []
  
  for (const segment of segments) {
    const duration = segment.endTime - segment.startTime
    
    if (duration < MIN_SEGMENT_DURATION && result.length > 0) {
      // Merge with previous segment
      const prev = result[result.length - 1]!
      prev.endTime = segment.endTime
      prev.endIndex = segment.endIndex
      prev.elevationChange += segment.elevationChange
      prev.distance += segment.distance
    } else {
      result.push({ ...segment })
    }
  }
  
  return result
}

/**
 * Filter idle segments - only keep those >= IDLE_MIN_DURATION
 * Shorter idle periods get merged into adjacent segments
 */
function filterIdleSegments(segments: RideSegment[]): RideSegment[] {
  if (segments.length < 2) return segments
  
  const result: RideSegment[] = []
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const duration = segment.endTime - segment.startTime
    
    if (segment.type === 'idle' && duration < IDLE_MIN_DURATION) {
      // Short idle - merge with previous or next segment
      if (result.length > 0) {
        const prev = result[result.length - 1]!
        prev.endTime = segment.endTime
        prev.endIndex = segment.endIndex
        prev.elevationChange += segment.elevationChange
        prev.distance += segment.distance
      } else if (i + 1 < segments.length) {
        // Merge into next segment (will be handled when we process it)
        const next = segments[i + 1]!
        next.startTime = segment.startTime
        next.startIndex = segment.startIndex
        next.elevationChange += segment.elevationChange
        next.distance += segment.distance
      }
    } else {
      result.push({ ...segment })
    }
  }
  
  return result
}

/**
 * Get all idle segments (for skip functionality)
 */
export function getIdleSegments(segments: RideSegment[]): RideSegment[] {
  return segments.filter(s => s.type === 'idle')
}

/**
 * Find the next non-idle time after a given time
 * Used for skip functionality
 */
export function findNextActivityTime(segments: RideSegment[], currentTime: number): number | null {
  for (const segment of segments) {
    // If we're currently in an idle segment, return the end of it
    if (segment.type === 'idle' && 
        currentTime >= segment.startTime && 
        currentTime < segment.endTime) {
      return segment.endTime
    }
  }
  return null
}

/**
 * Check if a given time is within an idle segment
 */
export function isInIdleSegment(segments: RideSegment[], time: number): boolean {
  return segments.some(s => 
    s.type === 'idle' && 
    time >= s.startTime && 
    time < s.endTime
  )
}
