/**
 * Region configuration
 *
 * Centralized geographic configuration for the ski area.
 * Designed to be easily extendable for user-defined regions in the future.
 */

export interface RegionConfig {
  /** Region name */
  name: string;
  /** Center point of the region (for camera positioning) */
  center: {
    lat: number;
    lon: number;
    elevation: number;
  };
  /** Geographic bounds */
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * Sölden ski area configuration
 * Includes Rettenbach & Tiefenbach glaciers
 */
export const SOLDEN_REGION: RegionConfig = {
  name: 'Sölden',
  center: {
    lat: 46.9147,
    lon: 10.9975,
    elevation: 2284,
  },
  bounds: {
    minLat: 46.84,
    maxLat: 47.01,
    minLon: 10.86,
    maxLon: 11.2,
  },
};

/**
 * Currently active region
 * In the future, this could be loaded from user preferences or URL params
 */
export const ACTIVE_REGION = SOLDEN_REGION;

/**
 * Convert bounds to bbox format (for APIs like Overpass)
 */
export function boundsToBbox(bounds: RegionConfig['bounds']) {
  return {
    south: bounds.minLat,
    north: bounds.maxLat,
    west: bounds.minLon,
    east: bounds.maxLon,
  };
}

/**
 * Helper to check if coordinates are within region bounds
 */
export function isInRegionBounds(
  lat: number,
  lon: number,
  region: RegionConfig = ACTIVE_REGION
): boolean {
  return (
    lat >= region.bounds.minLat &&
    lat <= region.bounds.maxLat &&
    lon >= region.bounds.minLon &&
    lon <= region.bounds.maxLon
  );
}

// Re-export commonly used values for convenience
export const { center: SOLDEN_CENTER, bounds: SOLDEN_BOUNDS } = SOLDEN_REGION;

/** Sölden bounding box in Overpass API format */
export const SOLDEN_BBOX = boundsToBbox(SOLDEN_BOUNDS);
