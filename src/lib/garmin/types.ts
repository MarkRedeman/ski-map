/**
 * Types for ski runs imported from Garmin/GPX files
 */

/**
 * A single point along a ski run with GPS and optional sensor data
 */
export interface RunPoint {
  lat: number
  lon: number
  elevation: number
  time: Date
  speed?: number // m/s, calculated from time/distance between points
  heartRate?: number // bpm, from sensor data if available
}

/**
 * A complete ski run with computed statistics
 */
export interface SkiRun {
  id: string
  name: string
  date: Date
  duration: number // seconds
  distance: number // meters
  elevationGain: number // meters
  elevationLoss: number // meters
  maxSpeed: number // m/s
  avgSpeed: number // m/s
  coordinates: RunPoint[]
}

/**
 * Serializable version of SkiRun for storage in IndexedDB
 * Dates are stored as ISO strings
 */
export interface SkiRunSerialized {
  id: string
  name: string
  date: string // ISO string
  duration: number
  distance: number
  elevationGain: number
  elevationLoss: number
  maxSpeed: number
  avgSpeed: number
  coordinates: RunPointSerialized[]
}

/**
 * Serializable version of RunPoint
 */
export interface RunPointSerialized {
  lat: number
  lon: number
  elevation: number
  time: string // ISO string
  speed?: number
  heartRate?: number
}

/**
 * Convert a SkiRun to serializable format for IndexedDB
 */
export function serializeRun(run: SkiRun): SkiRunSerialized {
  return {
    ...run,
    date: run.date.toISOString(),
    coordinates: run.coordinates.map((point) => ({
      ...point,
      time: point.time.toISOString(),
    })),
  }
}

/**
 * Convert a serialized SkiRun back to full SkiRun
 */
export function deserializeRun(run: SkiRunSerialized): SkiRun {
  return {
    ...run,
    date: new Date(run.date),
    coordinates: run.coordinates.map((point) => ({
      ...point,
      time: new Date(point.time),
    })),
  }
}
