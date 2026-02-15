/**
 * Geographic coordinate utilities for converting between
 * lat/lon coordinates and local 3D scene coordinates
 */

import { SOLDEN_CENTER, SOLDEN_BOUNDS } from '@/config/region';

// Re-export for backward compatibility
export { SOLDEN_CENTER, SOLDEN_BOUNDS };

// Scale factor: meters per unit in 3D scene
const SCALE = 0.1; // 1 unit = 10 meters

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Convert latitude/longitude to local X/Z coordinates centered on Sölden
 * Y is reserved for elevation
 */
export function geoToLocal(lat: number, lon: number, elevation = 0): [number, number, number] {
  // Calculate distance from center
  const dLat = (lat - SOLDEN_CENTER.lat) * (Math.PI / 180);
  const dLon = (lon - SOLDEN_CENTER.lon) * (Math.PI / 180);

  // Approximate meters from center
  const latMeters = dLat * EARTH_RADIUS;
  const lonMeters = dLon * EARTH_RADIUS * Math.cos((SOLDEN_CENTER.lat * Math.PI) / 180);

  // Convert to scene coordinates (Z = north, X = east, Y = up)
  const x = lonMeters * SCALE;
  const y = (elevation - SOLDEN_CENTER.elevation) * SCALE;
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
  const lonMeters = x / SCALE;
  const latMeters = -z / SCALE;
  const elevation = y / SCALE + SOLDEN_CENTER.elevation;

  const dLat = latMeters / EARTH_RADIUS;
  const dLon = lonMeters / (EARTH_RADIUS * Math.cos((SOLDEN_CENTER.lat * Math.PI) / 180));

  return {
    lat: SOLDEN_CENTER.lat + dLat * (180 / Math.PI),
    lon: SOLDEN_CENTER.lon + dLon * (180 / Math.PI),
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
 * Get bounds of the Sölden ski area in local coordinates
 * Includes padding to ensure all pistes are covered by terrain
 */
export function getSoldenBounds() {
  const { minLat, maxLat, minLon, maxLon } = SOLDEN_BOUNDS;

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
 * Check if a geographic coordinate is within the Sölden ski area bounds
 * @deprecated Use isInRegionBounds from @/config/region instead
 */
export function isInSoldenBounds(lat: number, lon: number): boolean {
  return (
    lat >= SOLDEN_BOUNDS.minLat &&
    lat <= SOLDEN_BOUNDS.maxLat &&
    lon >= SOLDEN_BOUNDS.minLon &&
    lon <= SOLDEN_BOUNDS.maxLon
  );
}
