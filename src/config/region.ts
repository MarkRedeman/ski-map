/**
 * Region configuration
 *
 * Default geographic configuration for the ski area.
 * Runtime overrides are managed by useAppConfigStore.
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
 * Default region: Sölden ski area (includes Rettenbach & Tiefenbach glaciers)
 */
export const DEFAULT_REGION: RegionConfig = {
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
