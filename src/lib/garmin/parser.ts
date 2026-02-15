/**
 * GPX file parser for ski runs
 * Uses @tmcw/togeojson to convert GPX to GeoJSON, then extracts run data
 */

import { gpx } from '@tmcw/togeojson';
import type { SkiRun, RunPoint } from './types';
import { distanceMeters } from '@/lib/geo/coordinates';

/**
 * Parse a GPX file and extract ski run data
 * @param file - The GPX file to parse
 * @returns Parsed SkiRun with computed statistics
 */
export async function parseGPXFile(file: File): Promise<SkiRun> {
  const text = await file.text();
  return parseGPXString(text, file.name);
}

/**
 * Parse GPX string content
 */
export function parseGPXString(gpxContent: string, fileName: string): SkiRun {
  // Parse GPX to DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'text/xml');

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid GPX file: ${parseError.textContent}`);
  }

  // Convert to GeoJSON
  const geoJSON = gpx(doc);

  if (!geoJSON.features || geoJSON.features.length === 0) {
    throw new Error('No track data found in GPX file');
  }

  // Extract coordinates and times from all features
  const coordinates: RunPoint[] = [];
  let trackName = '';
  let trackDate: Date | null = null;

  for (const feature of geoJSON.features) {
    // Get track name from properties
    if (!trackName && feature.properties?.name) {
      trackName = feature.properties.name;
    }

    // Get track time
    if (!trackDate && feature.properties?.time) {
      trackDate = new Date(feature.properties.time);
    }

    // Extract coordinates based on geometry type
    if (feature.geometry && feature.geometry.type === 'LineString') {
      extractLineStringPoints(
        feature.geometry as GeoJSON.LineString,
        feature.properties,
        coordinates
      );
    } else if (feature.geometry && feature.geometry.type === 'MultiLineString') {
      const geom = feature.geometry as GeoJSON.MultiLineString;
      for (let i = 0; i < geom.coordinates.length; i++) {
        extractMultiLineStringPoints(geom, i, feature.properties, coordinates);
      }
    }
  }

  if (coordinates.length === 0) {
    throw new Error('No coordinates found in GPX file');
  }

  // Sort by time if available
  coordinates.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Calculate speeds between points
  calculateSpeeds(coordinates);

  // Compute statistics
  const stats = computeStatistics(coordinates);

  // Generate unique ID
  const id = generateRunId();

  // Use filename without extension as fallback name
  const name = trackName || fileName.replace(/\.gpx$/i, '') || 'Unnamed Run';

  // Use first point time or current date as fallback
  const date = trackDate || coordinates[0]?.time || new Date();

  return {
    id,
    name,
    date,
    duration: stats.duration,
    distance: stats.distance,
    elevationGain: stats.elevationGain,
    elevationLoss: stats.elevationLoss,
    maxSpeed: stats.maxSpeed,
    avgSpeed: stats.avgSpeed,
    coordinates,
  };
}

/**
 * Extract points from a LineString geometry
 */
function extractLineStringPoints(
  geometry: GeoJSON.LineString,
  properties: GeoJSON.GeoJsonProperties,
  points: RunPoint[]
): void {
  const coords = geometry.coordinates;
  const times = (properties?.coordinateProperties as { times?: string[] } | undefined)?.times;

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    if (!coord) continue;
    const lon = coord[0] ?? 0;
    const lat = coord[1] ?? 0;
    const elevation = coord[2] ?? 0;
    const timeStr = times?.[i];
    const time = timeStr ? new Date(timeStr) : new Date(Date.now() + i * 1000);

    points.push({
      lat,
      lon,
      elevation,
      time,
    });
  }
}

/**
 * Extract points from a MultiLineString segment
 */
function extractMultiLineStringPoints(
  geometry: GeoJSON.MultiLineString,
  segmentIndex: number,
  properties: GeoJSON.GeoJsonProperties,
  points: RunPoint[]
): void {
  const coords = geometry.coordinates[segmentIndex];
  if (!coords) return;

  const allTimes = (properties?.coordinateProperties as { times?: string[][] } | undefined)?.times;
  const times = allTimes?.[segmentIndex];

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    if (!coord) continue;
    const lon = coord[0] ?? 0;
    const lat = coord[1] ?? 0;
    const elevation = coord[2] ?? 0;
    const timeStr = times?.[i];
    const time = timeStr ? new Date(timeStr) : new Date(Date.now() + i * 1000);

    points.push({
      lat,
      lon,
      elevation,
      time,
    });
  }
}

/**
 * Calculate speed for each point based on distance and time from previous point
 */
function calculateSpeeds(points: RunPoint[]): void {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;

    const distance = distanceMeters(prev.lat, prev.lon, curr.lat, curr.lon);
    const timeDiff = (curr.time.getTime() - prev.time.getTime()) / 1000; // seconds

    if (timeDiff > 0) {
      curr.speed = distance / timeDiff; // m/s
    } else {
      curr.speed = 0;
    }
  }

  // First point has no speed
  const first = points[0];
  if (first) {
    first.speed = 0;
  }
}

/**
 * Compute statistics from coordinate points
 */
function computeStatistics(points: RunPoint[]): {
  duration: number;
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  maxSpeed: number;
  avgSpeed: number;
} {
  if (points.length < 2) {
    return {
      duration: 0,
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      maxSpeed: 0,
      avgSpeed: 0,
    };
  }

  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxSpeed = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;

    // Distance
    totalDistance += distanceMeters(prev.lat, prev.lon, curr.lat, curr.lon);

    // Elevation changes (with small threshold to filter noise)
    const elevDiff = curr.elevation - prev.elevation;
    if (elevDiff > 1) {
      elevationGain += elevDiff;
    } else if (elevDiff < -1) {
      elevationLoss += Math.abs(elevDiff);
    }

    // Max speed
    if (curr.speed !== undefined && curr.speed > maxSpeed) {
      maxSpeed = curr.speed;
    }
  }

  // Duration
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (!firstPoint || !lastPoint) {
    return {
      duration: 0,
      distance: totalDistance,
      elevationGain,
      elevationLoss,
      maxSpeed,
      avgSpeed: 0,
    };
  }

  const startTime = firstPoint.time.getTime();
  const endTime = lastPoint.time.getTime();
  const duration = (endTime - startTime) / 1000; // seconds

  // Average speed (excluding stopped time)
  const avgSpeed = duration > 0 ? totalDistance / duration : 0;

  return {
    duration,
    distance: totalDistance,
    elevationGain,
    elevationLoss,
    maxSpeed,
    avgSpeed,
  };
}

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * Format distance in meters to human readable string
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format speed in m/s to km/h
 */
export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format elevation in meters
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}
