/**
 * Region configuration
 * 
 * Centralized geographic configuration for the ski area.
 * Designed to be easily extendable for user-defined regions in the future.
 */

export interface RegionConfig {
  /** Region name */
  name: string
  /** Center point of the region (for camera positioning) */
  center: {
    lat: number
    lon: number
    elevation: number
  }
  /** Geographic bounds */
  bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }
  /** Bounding box format (for APIs like Overpass) */
  bbox: {
    south: number
    north: number
    west: number
    east: number
  }
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
  bbox: {
    south: 46.84,
    north: 46.98,
    west: 10.86,
    east: 11.15,
  },
}

/**
 * Currently active region
 * In the future, this could be loaded from user preferences or URL params
 */
export const ACTIVE_REGION = SOLDEN_REGION

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
  )
}

/**
 * Get region bounds in different formats
 */
export function getRegionBounds(region: RegionConfig = ACTIVE_REGION) {
  return {
    // Geographic bounds
    geo: region.bounds,
    // Bounding box format
    bbox: region.bbox,
    // Center point
    center: region.center,
  }
}

// Re-export commonly used values for convenience
export const { center: SOLDEN_CENTER, bounds: SOLDEN_BOUNDS, bbox: SOLDEN_BBOX } = SOLDEN_REGION
