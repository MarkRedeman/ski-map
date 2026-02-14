/**
 * Types and utilities for Remotion video generation
 * 
 * These types bridge the existing SkiRun data from @/lib/garmin/types
 * to the format needed for Remotion video compositions.
 */

import type { SkiRun as GarminSkiRun, RunPoint as GarminRunPoint } from '@/lib/garmin/types'

/**
 * A simplified run point for video rendering
 */
export interface VideoRunPoint {
  lat: number
  lon: number
  elevation: number
  /** Timestamp in milliseconds */
  timestamp: number
  /** Speed in m/s */
  speed: number
}

/**
 * Run data formatted for video generation
 */
export interface VideoSkiRun {
  id: string
  name: string
  date: Date
  /** Array of recorded GPS points with metadata */
  points: VideoRunPoint[]
  /** Total distance in meters */
  totalDistance: number
  /** Total elevation descended in meters */
  elevationDrop: number
  /** Maximum speed in m/s */
  maxSpeed: number
  /** Average speed in m/s */
  avgSpeed: number
  /** Duration in seconds */
  duration: number
  /** Difficulty level of the run */
  difficulty: 'blue' | 'red' | 'black'
}

/**
 * Convert a garmin SkiRun to VideoSkiRun format
 */
export function toVideoSkiRun(run: GarminSkiRun): VideoSkiRun {
  // Convert coordinates to video points
  const points: VideoRunPoint[] = run.coordinates.map((coord: GarminRunPoint) => ({
    lat: coord.lat,
    lon: coord.lon,
    elevation: coord.elevation,
    timestamp: coord.time.getTime(),
    speed: coord.speed ?? 0,
  }))

  // Estimate difficulty based on average slope angle
  const difficulty = estimateDifficulty(run.elevationLoss, run.distance)

  return {
    id: run.id,
    name: run.name,
    date: run.date,
    points,
    totalDistance: run.distance,
    elevationDrop: run.elevationLoss,
    maxSpeed: run.maxSpeed,
    avgSpeed: run.avgSpeed,
    duration: run.duration,
    difficulty,
  }
}

/**
 * Estimate run difficulty based on slope angle
 */
function estimateDifficulty(
  elevationLoss: number,
  distance: number
): 'blue' | 'red' | 'black' {
  if (distance === 0) return 'blue'
  
  // Calculate average slope percentage
  const slopePercent = (elevationLoss / distance) * 100
  
  // Difficulty thresholds based on typical ski classifications:
  // Blue: < 25% slope (< 14 degrees)
  // Red: 25-40% slope (14-22 degrees)
  // Black: > 40% slope (> 22 degrees)
  if (slopePercent < 25) return 'blue'
  if (slopePercent < 40) return 'red'
  return 'black'
}

/**
 * Calculate the current values at a specific time in the run
 */
export function getRunValuesAtTime(
  run: VideoSkiRun,
  timeSeconds: number
): {
  position: [number, number, number]
  speed: number
  elevation: number
  distance: number
} {
  if (run.points.length === 0) {
    return {
      position: [0, 0, 0],
      speed: 0,
      elevation: 0,
      distance: 0,
    }
  }

  const startTime = run.points[0]?.timestamp ?? 0
  const targetTime = startTime + timeSeconds * 1000

  // Find the two points that bracket the target time
  let prevPoint = run.points[0]!
  let nextPoint = run.points[run.points.length - 1]!
  let accumulatedDistance = 0

  for (let i = 0; i < run.points.length - 1; i++) {
    const current = run.points[i]!
    const next = run.points[i + 1]!
    
    if (next.timestamp >= targetTime && current.timestamp <= targetTime) {
      prevPoint = current
      nextPoint = next
      break
    }
    
    // Accumulate distance
    accumulatedDistance += calculateDistance(
      current.lat, current.lon,
      next.lat, next.lon
    )
  }

  // Interpolate between the two points
  const timeDiff = nextPoint.timestamp - prevPoint.timestamp
  const t = timeDiff > 0 
    ? Math.max(0, Math.min(1, (targetTime - prevPoint.timestamp) / timeDiff))
    : 0

  const lat = prevPoint.lat + (nextPoint.lat - prevPoint.lat) * t
  const lon = prevPoint.lon + (nextPoint.lon - prevPoint.lon) * t
  const elevation = prevPoint.elevation + (nextPoint.elevation - prevPoint.elevation) * t
  const speed = prevPoint.speed + (nextPoint.speed - prevPoint.speed) * t

  return {
    position: [lat, lon, elevation],
    speed,
    elevation,
    distance: accumulatedDistance,
  }
}

/**
 * Haversine distance calculation
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

import { SOLDEN_CENTER } from '@/config/region'

/**
 * Create a demo run for testing video generation
 */
export function createDemoVideoRun(): VideoSkiRun {
  const points: VideoRunPoint[] = []
  const startLat = SOLDEN_CENTER.lat
  const startLon = SOLDEN_CENTER.lon
  const startElevation = 2800
  const startTime = Date.now()
  
  // Generate 60 points over 3 minutes (180 seconds)
  for (let i = 0; i <= 60; i++) {
    const t = i / 60 // Progress 0 to 1
    
    // Simulate a curvy descent
    const lat = startLat + t * 0.015 + Math.sin(t * Math.PI * 4) * 0.002
    const lon = startLon + t * 0.008 + Math.cos(t * Math.PI * 3) * 0.003
    const elevation = startElevation - t * 450 + Math.sin(t * Math.PI * 6) * 20
    
    // Speed varies - faster in middle, slower at turns
    const baseSpeed = 12 + Math.sin(t * Math.PI) * 6
    const speed = baseSpeed - Math.abs(Math.sin(t * Math.PI * 4)) * 4
    
    points.push({
      lat,
      lon,
      elevation,
      timestamp: startTime + t * 180 * 1000,
      speed: Math.max(3, speed),
    })
  }
  
  return {
    id: 'demo-run-1',
    name: 'Giggijoch Descent',
    date: new Date('2024-01-15T10:30:00'),
    difficulty: 'red',
    totalDistance: 2500,
    elevationDrop: 450,
    maxSpeed: 18.5,
    avgSpeed: 12.3,
    duration: 180, // 3 minutes
    points,
  }
}
