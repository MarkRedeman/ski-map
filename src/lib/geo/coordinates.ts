/**
 * Geographic coordinate utilities for converting between
 * lat/lon coordinates and local 3D scene coordinates
 *
 * Uses getRegionCenter/getRegionBounds from the app config store,
 * which fall back to DEFAULT_REGION when no override is set.
 */

import { getRegionCenter, getRegionBounds } from '@/stores/useAppConfigStore';
import { sampleElevation } from './elevationGrid';
import type { ElevationGrid } from './elevationGrid';

// Scale factor: meters per unit in 3D scene
const SCALE = 0.1; // 1 unit = 10 meters

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Convert latitude/longitude to local X/Z coordinates centered on the active region
 * Y is reserved for elevation
 */
export function geoToLocal(lat: number, lon: number, elevation = 0): [number, number, number] {
  const center = getRegionCenter();

  // Calculate distance from center
  const dLat = (lat - center.lat) * (Math.PI / 180);
  const dLon = (lon - center.lon) * (Math.PI / 180);

  // Approximate meters from center
  const latMeters = dLat * EARTH_RADIUS;
  const lonMeters = dLon * EARTH_RADIUS * Math.cos((center.lat * Math.PI) / 180);

  // Convert to scene coordinates (Z = north, X = east, Y = up)
  const x = lonMeters * SCALE;
  const y = (elevation - center.elevation) * SCALE;
  const z = -latMeters * SCALE; // Negative because north is -Z in Three.js convention

  return [x, y, z];
}

/**
 * Convert array of [lon, lat] coordinates to local 3D coordinates
 */
export function coordsToLocal(
  coordinates: [number, number][],
  elevation = 0
): [number, number, number][] {
  return coordinates.map(([lon, lat]) => geoToLocal(lat, lon, elevation));
}

/**
 * Convert local X/Z coordinates back to latitude/longitude
 */
export function localToGeo(
  x: number,
  y: number,
  z: number
): { lat: number; lon: number; elevation: number } {
  const center = getRegionCenter();

  const lonMeters = x / SCALE;
  const latMeters = -z / SCALE;
  const elevation = y / SCALE + center.elevation;

  const dLat = latMeters / EARTH_RADIUS;
  const dLon = lonMeters / (EARTH_RADIUS * Math.cos((center.lat * Math.PI) / 180));

  return {
    lat: center.lat + dLat * (180 / Math.PI),
    lon: center.lon + dLon * (180 / Math.PI),
    elevation,
  };
}

/**
 * Calculate distance between two lat/lon points in meters (Haversine formula)
 */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Get bounds of the active region in local coordinates
 * Includes padding to ensure all pistes are covered by terrain
 */
export function getLocalBounds() {
  const bounds = getRegionBounds();
  const { minLat, maxLat, minLon, maxLon } = bounds;

  const [minX, , minZ] = geoToLocal(minLat, minLon);
  const [maxX, , maxZ] = geoToLocal(maxLat, maxLon);

  const actualMinX = Math.min(minX, maxX);
  const actualMaxX = Math.max(minX, maxX);
  const actualMinZ = Math.min(minZ, maxZ);
  const actualMaxZ = Math.max(minZ, maxZ);

  // Calculate actual center of the bounding box (not 0,0!)
  const centerX = (actualMinX + actualMaxX) / 2;
  const centerZ = (actualMinZ + actualMaxZ) / 2;

  return {
    minX: actualMinX,
    maxX: actualMaxX,
    minZ: actualMinZ,
    maxZ: actualMaxZ,
    centerX,
    centerZ,
    width: Math.abs(actualMaxX - actualMinX),
    depth: Math.abs(actualMaxZ - actualMinZ),
  };
}

/**
 * Get real-world elevation in meters for a lat/lon point using the terrain grid.
 * Converts geo → local → samples terrain → converts back to meters.
 * Returns null if elevationGrid is not available.
 */
export function getElevationMeters(lat: number, lon: number, elevationGrid: ElevationGrid): number {
  const [x, , z] = geoToLocal(lat, lon, 0);
  const y = sampleElevation(elevationGrid, x, z);
  return localToGeo(x, y, z).elevation;
}

/**
 * Check if a geographic coordinate is within the active region bounds
 */
export function isInRegionBounds(lat: number, lon: number): boolean {
  const bounds = getRegionBounds();
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon
  );
}
